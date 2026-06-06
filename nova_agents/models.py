from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


REQUIRED_FIELDS = [
    "consignee_name",
    "hs_code",
    "port_of_loading",
    "port_of_discharge",
    "incoterms",
    "description_of_goods",
    "gross_weight",
    "invoice_number",
]


class ValidationStatus(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    UNCERTAIN = "uncertain"


class DecisionOutcome(str, Enum):
    AUTO_APPROVE = "auto_approve"
    HUMAN_REVIEW = "human_review"
    AMENDMENT_REQUEST = "amendment_request"


@dataclass
class ExtractedField:
    name: str
    value: str | None
    confidence: float
    source_snippet: str = ""
    evidence: str = ""


@dataclass
class ExtractionResult:
    document_name: str
    fields: dict[str, ExtractedField]
    provider: str
    raw_text: str = ""
    warnings: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    field_name: str
    status: ValidationStatus
    found: str | None
    expected: str | None
    confidence: float
    reason: str
    source_snippet: str = ""


@dataclass
class Decision:
    outcome: DecisionOutcome
    reasoning: str
    draft_message: str
    blockers: list[str] = field(default_factory=list)


@dataclass
class PipelineRun:
    id: str
    document_name: str
    customer_id: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    extraction: ExtractionResult | None = None
    validations: list[ValidationResult] = field(default_factory=list)
    decision: Decision | None = None


def field_to_dict(field: ExtractedField) -> dict[str, Any]:
    return {
        "name": field.name,
        "value": field.value,
        "confidence": field.confidence,
        "source_snippet": field.source_snippet,
        "evidence": field.evidence,
    }

