import base64
import json
import mimetypes
import os
import re
import subprocess
from pathlib import Path

from .models import ExtractionResult, ExtractedField, REQUIRED_FIELDS


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
        self.use_llm = bool(os.getenv("OPENAI_API_KEY")) if use_llm is None else use_llm

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
            warnings.append("No readable text found. Configure OPENAI_API_KEY for vision extraction on scanned documents.")
        return ExtractionResult(path.name, fields, provider="local-patterns", raw_text=text, warnings=warnings)

    def _extract_with_llm(self, path: Path, text: str) -> ExtractionResult:
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
        payload = json.loads(response.output_text)
        fields = {}
        for name in REQUIRED_FIELDS:
            item = payload.get(name) or {}
            fields[name] = ExtractedField(
                name=name,
                value=item.get("value"),
                confidence=float(item.get("confidence") or 0),
                source_snippet=item.get("source_snippet") or "",
                evidence="vision_llm",
            )
        return ExtractionResult(path.name, fields, provider="openai-vision", raw_text=text)

    def _snippet(self, text: str, value: str | None) -> str:
        if not value:
            return ""
        index = text.lower().find(value.lower())
        if index < 0:
            return value
        start = max(index - 60, 0)
        end = min(index + len(value) + 60, len(text))
        return " ".join(text[start:end].split())

