import json
import re
from pathlib import Path

from .models import ExtractionResult, ValidationResult, ValidationStatus


class ValidatorAgent:
    def __init__(self, rule_path: str | Path) -> None:
        self.rule_set = json.loads(Path(rule_path).read_text(encoding="utf-8"))

    def run(self, extraction: ExtractionResult) -> list[ValidationResult]:
        results = []
        for field_name, rule in self.rule_set["rules"].items():
            field = extraction.fields[field_name]
            status, reason = self._evaluate(field.value, field.confidence, field.source_snippet, rule)
            results.append(
                ValidationResult(
                    field_name=field_name,
                    status=status,
                    found=field.value,
                    expected=self._expected_text(rule),
                    confidence=field.confidence,
                    reason=reason,
                    source_snippet=field.source_snippet,
                )
            )
        return results

    def _evaluate(
        self,
        found: str | None,
        confidence: float,
        source_snippet: str,
        rule: dict,
    ) -> tuple[ValidationStatus, str]:
        if not found:
            return ValidationStatus.UNCERTAIN, "Required field was not found in the document."
        if confidence < 0.7:
            return ValidationStatus.UNCERTAIN, "Extraction confidence is below approval threshold."
        if not source_snippet.strip():
            return ValidationStatus.UNCERTAIN, "Extraction has no source evidence from the document."

        rule_type = rule["type"]
        expected = rule["expected"]
        normalized = found.strip().lower()
        if rule_type == "exact":
            ok = normalized == str(expected).lower()
        elif rule_type == "one_of":
            ok = normalized in {str(item).lower() for item in expected}
        elif rule_type == "contains":
            ok = str(expected).lower() in normalized
        elif rule_type == "pattern":
            ok = bool(re.match(str(expected), found.strip()))
        elif rule_type == "max_number":
            ok = self._number(found) <= float(expected)
        else:
            return ValidationStatus.UNCERTAIN, f"Unsupported rule type: {rule_type}."

        if ok:
            return ValidationStatus.MATCH, "Field satisfies the customer rule."
        return ValidationStatus.MISMATCH, "Field does not satisfy the customer rule."

    def _number(self, value: str) -> float:
        match = re.search(r"[0-9,.]+", value)
        if not match:
            return float("inf")
        return float(match.group(0).replace(",", ""))

    def _expected_text(self, rule: dict) -> str:
        expected = rule["expected"]
        if isinstance(expected, list):
            return ", ".join(str(item) for item in expected)
        suffix = f" {rule['unit']}" if "unit" in rule else ""
        return f"{expected}{suffix}"
