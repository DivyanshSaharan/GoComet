import json
import sqlite3
from contextlib import closing
from pathlib import Path

from .models import PipelineRun, field_to_dict


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
                (id, document_name, customer_id, created_at, provider, decision_outcome, reasoning, draft_message)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.id,
                    run.document_name,
                    run.customer_id,
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

    def answer(self, question: str) -> str:
        q = question.lower()
        with closing(self._connect()) as conn:
            if "flagged" in q or "pending" in q or "review" in q:
                count = conn.execute(
                    """
                    select count(*) from runs
                    where decision_outcome in ('human_review', 'amendment_request')
                    """
                ).fetchone()[0]
                return f"{count} shipment document run(s) are pending CG attention."
            if "approved" in q:
                count = conn.execute("select count(*) from runs where decision_outcome = 'auto_approve'").fetchone()[0]
                return f"{count} shipment document run(s) were auto-approved."
            if "mismatch" in q or "discrepancy" in q:
                rows = conn.execute(
                    """
                    select field_name, found, expected from validations
                    where status = 'mismatch'
                    order by rowid desc limit 8
                    """
                ).fetchall()
                if not rows:
                    return "No mismatches are currently stored."
                return "; ".join(f"{name}: found {found}, expected {expected}" for name, found, expected in rows)
        return "I can answer stored-output questions about flagged, approved, or mismatched shipment runs."

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
                    created_at text not null,
                    provider text,
                    decision_outcome text,
                    reasoning text,
                    draft_message text
                )
                """
            )
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
