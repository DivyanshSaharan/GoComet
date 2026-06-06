import tempfile
import unittest
from pathlib import Path

from nova_agents.pipeline import TradeDocumentPipeline
from nova_agents.storage import RunStore


ROOT = Path(__file__).resolve().parents[1]


class PipelineTest(unittest.TestCase):
    def test_clean_document_auto_approves(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "runs.db"
            run = TradeDocumentPipeline(db_path=db).run(ROOT / "samples" / "clean_invoice.txt")

            self.assertEqual(run.decision.outcome.value, "auto_approve")
            self.assertTrue(all(item.status.value == "match" for item in run.validations))

    def test_messy_document_drafts_amendment(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "runs.db"
            run = TradeDocumentPipeline(db_path=db).run(ROOT / "samples" / "messy_invoice.txt")

            self.assertEqual(run.decision.outcome.value, "amendment_request")
            self.assertIn("hs_code", run.decision.blockers)
            self.assertIn("Please resend", run.decision.draft_message)

    def test_query_layer_answers_grounded_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "runs.db"
            pipeline = TradeDocumentPipeline(db_path=db)
            pipeline.run(ROOT / "samples" / "clean_invoice.txt")
            pipeline.run(ROOT / "samples" / "messy_invoice.txt")

            store = RunStore(db)
            self.assertIn("1 shipment", store.answer("how many shipments were flagged this week?"))
            self.assertIn("1 shipment", store.answer("how many were approved?"))
            query = store.query("show mismatches")
            self.assertEqual(query["route"], "latest_mismatches")
            self.assertIn("select field_name", query["sql"])

    def test_same_customer_document_is_deduplicated(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "runs.db"
            pipeline = TradeDocumentPipeline(db_path=db)
            first = pipeline.run(ROOT / "samples" / "clean_invoice.txt")
            second = pipeline.run(ROOT / "samples" / "clean_invoice.txt")

            self.assertEqual(first.id, second.id)
            self.assertTrue(second.reused_existing)
            self.assertTrue(second.document_path)

    def test_store_filters_and_updates_review_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "runs.db"
            pipeline = TradeDocumentPipeline(db_path=db)
            run = pipeline.run(ROOT / "samples" / "messy_invoice.txt")

            store = RunStore(db)
            self.assertEqual(run.review_status, "flagged")
            self.assertEqual(len(store.list_runs(status="flagged")), 1)

            updated = store.update_review_status(run.id, "rejected", "HS code needs correction.")
            self.assertEqual(updated["review_status"], "rejected")
            self.assertIn("supplier@example.com", updated["action_email"])
            self.assertIn("HS code needs correction.", updated["action_email"])

            closed = store.close_run(run.id)
            self.assertTrue(closed["closed_at"])


if __name__ == "__main__":
    unittest.main()
