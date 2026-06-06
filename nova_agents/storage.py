import json
import sqlite3
from contextlib import closing
from pathlib import Path

from .models import (
    Decision,
    DecisionOutcome,
    ExtractedField,
    ExtractionResult,
    PipelineRun,
    ValidationResult,
    ValidationStatus,
    field_to_dict,
)


class RunStore:
    def __init__(self, db_path: str | Path = "data/nova_runs.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def save(self, run: PipelineRun) -> None:
        with closing(self._connect()) as conn:
            conn.execute(
                """
                insert or replace into runs
                (id, document_name, customer_id, document_fingerprint, document_path, created_at, provider, decision_outcome, reasoning, draft_message)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.id,
                    run.document_name,
                    run.customer_id,
                    run.document_fingerprint,
                    run.document_path,
                    run.created_at,
                    run.extraction.provider if run.extraction else None,
                    run.decision.outcome.value if run.decision else None,
                    run.decision.reasoning if run.decision else None,
                    run.decision.draft_message if run.decision else None,
                ),
            )
            conn.execute("delete from fields where run_id = ?", (run.id,))
            conn.execute("delete from validations where run_id = ?", (run.id,))
            if run.extraction:
                for field in run.extraction.fields.values():
                    payload = field_to_dict(field)
                    conn.execute(
                        """
                        insert into fields
                        (run_id, name, value, confidence, source_snippet, evidence)
                        values (?, ?, ?, ?, ?, ?)
                        """,
                        (run.id, field.name, field.value, field.confidence, field.source_snippet, json.dumps(payload)),
                    )
            for item in run.validations:
                conn.execute(
                    """
                    insert into validations
                    (run_id, field_name, status, found, expected, confidence, reason, source_snippet)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run.id,
                        item.field_name,
                        item.status.value,
                        item.found,
                        item.expected,
                        item.confidence,
                        item.reason,
                        item.source_snippet,
                    ),
                )
            conn.commit()

    def find_by_fingerprint(self, customer_id: str, document_fingerprint: str) -> PipelineRun | None:
        if not document_fingerprint:
            return None
        with closing(self._connect()) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                select * from runs
                where customer_id = ? and document_fingerprint = ?
                order by created_at desc
                limit 1
                """,
                (customer_id, document_fingerprint),
            ).fetchone()
            if not row:
                return None
            return self._hydrate(conn, row)

    def latest_run(self) -> dict | None:
        with closing(self._connect()) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("select * from runs order by created_at desc limit 1").fetchone()
            if not row:
                return None
            run = dict(row)
            run["fields"] = [dict(item) for item in conn.execute("select * from fields where run_id = ?", (run["id"],))]
            run["validations"] = [
                dict(item) for item in conn.execute("select * from validations where run_id = ?", (run["id"],))
            ]
            return run

    def run_by_id(self, run_id: str) -> dict | None:
        with closing(self._connect()) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("select * from runs where id = ?", (run_id,)).fetchone()
            if not row:
                return None
            run = dict(row)
            run["fields"] = [dict(item) for item in conn.execute("select * from fields where run_id = ?", (run["id"],))]
            run["validations"] = [
                dict(item) for item in conn.execute("select * from validations where run_id = ?", (run["id"],))
            ]
            return run

    def answer(self, question: str) -> str:
        return self.query(question)["answer"]

    def query(self, question: str) -> dict[str, str]:
        q = question.lower()
        with closing(self._connect()) as conn:
            if "flagged" in q or "pending" in q or "review" in q:
                sql = """
                    select count(*) from runs
                    where decision_outcome in ('human_review', 'amendment_request')
                    """
                count = conn.execute(
                    sql
                ).fetchone()[0]
                return {
                    "answer": f"{count} shipment document run(s) are pending CG attention.",
                    "route": "flagged_or_pending_count",
                    "sql": " ".join(sql.split()),
                }
            if "approved" in q:
                sql = "select count(*) from runs where decision_outcome = 'auto_approve'"
                count = conn.execute(sql).fetchone()[0]
                return {
                    "answer": f"{count} shipment document run(s) were auto-approved.",
                    "route": "approved_count",
                    "sql": sql,
                }
            if "mismatch" in q or "discrepancy" in q:
                sql = """
                    select field_name, found, expected from validations
                    where status = 'mismatch'
                    order by rowid desc limit 8
                    """
                rows = conn.execute(
                    sql
                ).fetchall()
                if not rows:
                    answer = "No mismatches are currently stored."
                else:
                    answer = "; ".join(f"{name}: found {found}, expected {expected}" for name, found, expected in rows)
                return {
                    "answer": answer,
                    "route": "latest_mismatches",
                    "sql": " ".join(sql.split()),
                }
        return {
            "answer": "I can answer stored-output questions about flagged, approved, or mismatched shipment runs.",
            "route": "unsupported_question",
            "sql": "",
        }

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init(self) -> None:
        with closing(self._connect()) as conn:
            conn.execute(
                """
                create table if not exists runs (
                    id text primary key,
                    document_name text not null,
                    customer_id text not null,
                    document_fingerprint text,
                    document_path text,
                    created_at text not null,
                    provider text,
                    decision_outcome text,
                    reasoning text,
                    draft_message text
                )
                """
            )
            self._ensure_column(conn, "runs", "document_fingerprint", "text")
            self._ensure_column(conn, "runs", "document_path", "text")
            conn.commit()
            conn.execute(
                """
                create table if not exists fields (
                    run_id text not null,
                    name text not null,
                    value text,
                    confidence real,
                    source_snippet text,
                    evidence text,
                    foreign key(run_id) references runs(id)
                )
                """
            )
            conn.execute(
                """
                create table if not exists validations (
                    run_id text not null,
                    field_name text not null,
                    status text not null,
                    found text,
                    expected text,
                    confidence real,
                    reason text,
                    source_snippet text,
                    foreign key(run_id) references runs(id)
                )
                """
            )
            conn.execute(
                """
                create unique index if not exists idx_runs_customer_fingerprint
                on runs(customer_id, document_fingerprint)
                where document_fingerprint is not null and document_fingerprint != ''
                """
            )
            conn.commit()

    def _ensure_column(self, conn: sqlite3.Connection, table: str, column: str, column_type: str) -> None:
        columns = {row[1] for row in conn.execute(f"pragma table_info({table})").fetchall()}
        if column not in columns:
            conn.execute(f"alter table {table} add column {column} {column_type}")

    def _hydrate(self, conn: sqlite3.Connection, row: sqlite3.Row) -> PipelineRun:
        run = PipelineRun(
            id=row["id"],
            document_name=row["document_name"],
            customer_id=row["customer_id"],
            document_fingerprint=row["document_fingerprint"] or "",
            document_path=row["document_path"] or "",
            created_at=row["created_at"],
        )
        fields = {}
        for field_row in conn.execute("select * from fields where run_id = ?", (run.id,)):
            fields[field_row["name"]] = ExtractedField(
                name=field_row["name"],
                value=field_row["value"],
                confidence=field_row["confidence"],
                source_snippet=field_row["source_snippet"] or "",
                evidence="stored",
            )
        run.extraction = ExtractionResult(
            document_name=run.document_name,
            fields=fields,
            provider=row["provider"] or "stored",
        )
        run.validations = [
            ValidationResult(
                field_name=item["field_name"],
                status=ValidationStatus(item["status"]),
                found=item["found"],
                expected=item["expected"],
                confidence=item["confidence"],
                reason=item["reason"],
                source_snippet=item["source_snippet"] or "",
            )
            for item in conn.execute("select * from validations where run_id = ?", (run.id,))
        ]
        if row["decision_outcome"]:
            run.decision = Decision(
                outcome=DecisionOutcome(row["decision_outcome"]),
                reasoning=row["reasoning"] or "",
                draft_message=row["draft_message"] or "",
            )
        return run
