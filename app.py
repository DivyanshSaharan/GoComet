import os
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request, send_file, send_from_directory
from werkzeug.utils import secure_filename

from nova_agents.pipeline import TradeDocumentPipeline
from nova_agents.storage import RunStore


ROOT = Path(__file__).parent
DB_PATH = ROOT / "data" / "nova_runs.db"
UPLOAD_DIR = ROOT / "data" / "uploads"
WEB_DIR = ROOT / "frontend" / "dist"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
        return response

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.post("/api/runs")
    def create_run():
        customer_id = request.form.get("customer_id", "acme-global")
        document = None

        if "document" in request.files:
            upload = request.files["document"]
            if not upload.filename:
                return jsonify({"error": "uploaded document needs a filename"}), 400
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid4().hex}-{secure_filename(upload.filename)}"
            document_path = UPLOAD_DIR / filename
            upload.save(document_path)
            document = str(document_path)
        else:
            payload = request.get_json(silent=True) or {}
            document = payload.get("document")
            customer_id = payload.get("customer_id", customer_id)

        if not document:
            return jsonify({"error": "document is required"}), 400

        run = TradeDocumentPipeline(db_path=DB_PATH).run(document, customer_id=customer_id)
        return jsonify(asdict(run))

    @app.get("/api/runs/latest")
    def latest_run():
        return jsonify(RunStore(DB_PATH).latest_run() or {})

    @app.get("/api/runs")
    def list_runs():
        store = RunStore(DB_PATH)
        runs = store.list_runs(
            status=request.args.get("status") or None,
            name=request.args.get("name") or None,
            date_from=request.args.get("date_from") or None,
            date_to=request.args.get("date_to") or None,
        )
        return jsonify({"runs": runs})

    @app.get("/api/runs/<run_id>")
    def get_run(run_id: str):
        run = RunStore(DB_PATH).run_by_id(run_id)
        if not run:
            return jsonify({"error": "run not found"}), 404
        return jsonify(run)

    @app.delete("/api/runs/<run_id>")
    def delete_run(run_id: str):
        deleted = RunStore(DB_PATH).delete_run(run_id)
        if not deleted:
            return jsonify({"error": "run not found"}), 404
        return jsonify({"deleted": True, "id": run_id})

    @app.post("/api/runs/<run_id>/actions")
    def update_run_action(run_id: str):
        payload = request.get_json(silent=True) or {}
        action = payload.get("action")
        note = payload.get("note", "")
        store = RunStore(DB_PATH)
        if action == "close":
            run = store.close_run(run_id)
        elif action in {"approved", "rejected", "flagged"}:
            run = store.update_review_status(run_id, action, note)
        else:
            return jsonify({"error": "action must be approved, rejected, flagged, or close"}), 400
        if not run:
            return jsonify({"error": "run not found"}), 404
        return jsonify(run)

    @app.post("/api/batch-runs")
    def create_batch_runs():
        payload = request.get_json(silent=True) or {}
        folder = payload.get("folder")
        customer_id = payload.get("customer_id", "acme-global")
        if not folder:
            return jsonify({"error": "folder is required"}), 400
        folder_path = Path(folder)
        if not folder_path.exists() or not folder_path.is_dir():
            return jsonify({"error": "folder does not exist"}), 400

        allowed_suffixes = {".pdf", ".png", ".jpg", ".jpeg", ".txt", ".md", ".eml"}
        pipeline = TradeDocumentPipeline(db_path=DB_PATH)
        runs = []
        for document_path in sorted(folder_path.iterdir()):
            if document_path.is_file() and document_path.suffix.lower() in allowed_suffixes:
                runs.append(asdict(pipeline.run(document_path, customer_id=customer_id)))

        approved = sum(1 for run in runs if run.get("review_status") == "approved")
        flagged = sum(1 for run in runs if run.get("review_status") == "flagged")
        rejected = sum(1 for run in runs if run.get("review_status") == "rejected")
        return jsonify(
            {
                "folder": str(folder_path),
                "total": len(runs),
                "approved": approved,
                "flagged": flagged,
                "rejected": rejected,
                "runs": runs,
            }
        )

    @app.get("/api/query")
    def query_runs():
        question = request.args.get("q", "")
        return jsonify(RunStore(DB_PATH).query(question))

    @app.get("/api/runs/<run_id>/document")
    def run_document(run_id: str):
        run = RunStore(DB_PATH).run_by_id(run_id)
        if not run or not run.get("document_path"):
            return jsonify({"error": "document not found"}), 404

        document_path = Path(run["document_path"]).resolve()
        allowed_roots = [ROOT.resolve(), UPLOAD_DIR.resolve()]
        if not any(document_path == root or root in document_path.parents for root in allowed_roots):
            return jsonify({"error": "document path is outside the workspace"}), 403
        if not document_path.exists():
            return jsonify({"error": "document file is missing"}), 404

        if document_path.suffix.lower() in {".txt", ".md", ".eml"}:
            return jsonify(
                {
                    "name": document_path.name,
                    "type": "text",
                    "content": document_path.read_text(encoding="utf-8", errors="replace"),
                }
            )
        return send_file(document_path)

    @app.route("/", defaults={"path": "index.html"})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        if not WEB_DIR.exists():
            return jsonify({"message": "Frontend build not found. Run the React app in dev mode or build it first."}), 404
        target = WEB_DIR / path
        if not target.exists():
            path = "index.html"
        return send_from_directory(WEB_DIR, path)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8017"))
    app.run(host="127.0.0.1", port=port, debug=True)
