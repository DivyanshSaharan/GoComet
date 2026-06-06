import os
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory
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
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
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

    @app.get("/api/query")
    def query_runs():
        question = request.args.get("q", "")
        return jsonify({"answer": RunStore(DB_PATH).answer(question)})

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
