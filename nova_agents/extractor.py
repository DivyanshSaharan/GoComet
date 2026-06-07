import base64
import json
import mimetypes
import os
import re
import subprocess
from pathlib import Path

from .models import ExtractionResult, ExtractedField, REQUIRED_FIELDS

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


FIELD_PATTERNS = {
    "consignee_name": r"Consignee(?: Name)?:\s*(.+)",
    "hs_code": r"HS Code:\s*([A-Z0-9.\- ]+)",
    "port_of_loading": r"Port of Loading:\s*(.+)",
    "port_of_discharge": r"Port of Discharge:\s*(.+)",
    "incoterms": r"Incoterms?:\s*([A-Z]{3})",
    "description_of_goods": r"Description of Goods:\s*(.+)",
    "gross_weight": r"Gross Weight:\s*([0-9,.]+)\s*(kg|kgs|kilograms)?",
    "invoice_number": r"Invoice(?: Number| No\.?)?:\s*([A-Z0-9\-\/]+)",
}


class ExtractorAgent:
    def __init__(self, use_llm: bool | None = None) -> None:
        has_key = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("OPENAI_API_KEY"))
        self.use_llm = has_key if use_llm is None else use_llm

    def run(self, document_path: str | Path) -> ExtractionResult:
        path = Path(document_path)
        text = self._read_document(path)
        if self.use_llm:
            try:
                return self._extract_with_llm(path, text)
            except Exception as exc:
                local = self._extract_locally(path, text)
                local.warnings.append(f"LLM extraction failed; used local fallback: {exc}")
                return local
        return self._extract_locally(path, text)

    def _read_document(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            result = subprocess.run(
                ["pdftotext", str(path), "-"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout
        if suffix in {".txt", ".md", ".eml"}:
            return path.read_text(encoding="utf-8")
        return ""

    def _extract_locally(self, path: Path, text: str) -> ExtractionResult:
        fields: dict[str, ExtractedField] = {}
        for name in REQUIRED_FIELDS:
            match = re.search(FIELD_PATTERNS[name], text, flags=re.IGNORECASE)
            value = match.group(1).strip() if match else None
            if name == "gross_weight" and match:
                unit = match.group(2) or "kg"
                value = f"{value} {unit.lower()}"
            fields[name] = ExtractedField(
                name=name,
                value=value,
                confidence=0.86 if value else 0.25,
                source_snippet=self._snippet(text, value),
                evidence="pattern_extraction" if value else "missing_in_text",
            )
        warnings = []
        if not text.strip():
            warnings.append("No readable text found. Configure GEMINI_API_KEY for vision extraction on scanned documents.")
        return ExtractionResult(path.name, fields, provider="local-patterns", raw_text=text, warnings=warnings)

    def _extract_with_llm(self, path: Path, text: str) -> ExtractionResult:
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            return self._extract_with_gemini(path, text)
        return self._extract_with_openai(path, text)

    def _extract_with_gemini(self, path: Path, text: str) -> ExtractionResult:
        from google import genai
        from google.genai import types

        client = genai.Client()
        prompt = (
            "Extract trade document fields as strict JSON. Return an object where every key is one of "
            f"{', '.join(REQUIRED_FIELDS)}. Each value must be an object with value, confidence, and "
            "source_snippet. Confidence must be a number from 0 to 1. Use null when a field is not present."
        )
        contents: list = [prompt]
        if text.strip():
            contents.append(text[:12000])
        else:
            mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            contents.append(types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type))

        response = client.models.generate_content(
            model=os.getenv("NOVA_EXTRACTOR_MODEL", "gemini-2.5-flash"),
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        payload = self._parse_payload(response.text or "{}")
        return self._payload_to_result(path, text, payload, provider="gemini-vision")

    def _extract_with_openai(self, path: Path, text: str) -> ExtractionResult:
        from openai import OpenAI

        client = OpenAI()
        content: list[dict] = [
            {
                "type": "text",
                "text": (
                    "Extract trade document fields as JSON. Return every required field with "
                    "value, confidence from 0 to 1, and a short source_snippet. Required fields: "
                    f"{', '.join(REQUIRED_FIELDS)}."
                ),
            }
        ]
        if text.strip():
            content.append({"type": "text", "text": text[:12000]})
        else:
            mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}})

        response = client.responses.create(
            model=os.getenv("NOVA_EXTRACTOR_MODEL", "gpt-4.1-mini"),
            input=[{"role": "user", "content": content}],
            text={"format": {"type": "json_object"}},
        )
        payload = self._parse_payload(response.output_text)
        return self._payload_to_result(path, text, payload, provider="openai-vision")

    def _payload_to_result(self, path: Path, text: str, payload: dict, provider: str) -> ExtractionResult:
        if "fields" in payload and isinstance(payload["fields"], dict):
            payload = payload["fields"]
        fields = {}
        warnings = []
        for name in REQUIRED_FIELDS:
            item = payload.get(name) or {}
            value = item.get("value")
            source_snippet = item.get("source_snippet") or ""
            confidence = self._safe_confidence(item.get("confidence"))
            verified = self._snippet_is_grounded(text, source_snippet)
            if value and not verified:
                confidence = min(confidence, 0.69)
                if source_snippet:
                    warnings.append(f"{name} source snippet was not found in extracted document text.")
                else:
                    warnings.append(f"{name} has no source snippet from the document.")
            fields[name] = ExtractedField(
                name=name,
                value=value,
                confidence=confidence,
                source_snippet=source_snippet if verified else "",
                evidence=provider,
            )
        return ExtractionResult(path.name, fields, provider=provider, raw_text=text, warnings=warnings)

    def _parse_payload(self, content: str) -> dict:
        cleaned = content.strip()
        fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            cleaned = fenced.group(1).strip()
        if not cleaned.startswith("{"):
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start >= 0 and end > start:
                cleaned = cleaned[start : end + 1]
        return json.loads(cleaned or "{}")

    def _snippet(self, text: str, value: str | None) -> str:
        if not value:
            return ""
        index = text.lower().find(value.lower())
        if index < 0:
            return value
        start = max(index - 60, 0)
        end = min(index + len(value) + 60, len(text))
        return " ".join(text[start:end].split())

    def _safe_confidence(self, value: object) -> float:
        try:
            confidence = float(value or 0)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(confidence, 1.0))

    def _snippet_is_grounded(self, text: str, source_snippet: str) -> bool:
        snippet = " ".join(source_snippet.split())
        if not snippet:
            return False
        if not text.strip():
            return False
        normalized_text = " ".join(text.split()).lower()
        return snippet.lower() in normalized_text
