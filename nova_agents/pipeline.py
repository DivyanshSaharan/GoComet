from pathlib import Path
from hashlib import sha256
from uuid import uuid4

from .extractor import ExtractorAgent
from .models import PipelineRun
from .router import RouterAgent
from .storage import RunStore
from .validator import ValidatorAgent


class TradeDocumentPipeline:
    def __init__(
        self,
        rules_path: str | Path = "rules/acme_customer.json",
        db_path: str | Path = "data/nova_runs.db",
    ) -> None:
        self.extractor = ExtractorAgent()
        self.validator = ValidatorAgent(rules_path)
        self.router = RouterAgent()
        self.store = RunStore(db_path)

    def run(self, document_path: str | Path, customer_id: str = "acme-global") -> PipelineRun:
        document = Path(document_path)
        fingerprint = self._fingerprint(document)
        existing = self.store.find_by_fingerprint(customer_id, fingerprint)
        if existing:
            existing.reused_existing = True
            return existing

        run = PipelineRun(
            id=str(uuid4()),
            document_name=document.name,
            customer_id=customer_id,
            document_fingerprint=fingerprint,
            document_path=str(document),
        )
        run.extraction = self.extractor.run(document)
        run.validations = self.validator.run(run.extraction)
        run.decision = self.router.run(run.validations)
        self.store.save(run)
        return run

    def _fingerprint(self, document: Path) -> str:
        digest = sha256()
        with document.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
