# Nova Trade Document Pipeline

Part 1 POC for the GoComet Nova Full-Stack AI Engineer DAW.

This repo builds a small multi-agent pipeline for trade document validation:

1. Extract structured shipment fields from a PDF, image, or text document.
2. Validate the extracted fields against customer-specific rules.
3. Route the shipment to auto-approval, human review, or amendment drafting.
4. Store verified output in SQLite and answer simple grounded questions.
5. Show the full run state in a React workspace backed by a Flask API.


## Setup

Install backend dependencies:

```bash
python -m pip install -r requirements.txt
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Run The Pipeline

Run the deterministic local pipeline from the command line:

```bash
python cli.py samples/clean_invoice.txt
python cli.py samples/messy_invoice.txt
```

The first sample should auto-approve. The messy sample should create an amendment request.

## Run The Full-Stack App

Start Flask:

```bash
python app.py
```

Start React in another terminal:

```bash
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`. The UI can run a sample path or upload a document. React proxies `/api` calls to Flask on `http://127.0.0.1:8017`.

## SQLite Demo

The default database is `data/nova_runs.db`. It is created after the first pipeline run.

Useful CLI commands:

```bash
sqlite3 data/nova_runs.db ".tables"
sqlite3 data/nova_runs.db "select id, document_name, decision_outcome from runs;"
sqlite3 data/nova_runs.db "select name, value, confidence from fields;"
sqlite3 data/nova_runs.db "select field_name, status, found, expected from validations;"
```

For a GUI demo, open `data/nova_runs.db` in DB Browser for SQLite and browse:

- `runs`
- `fields`
- `validations`

## Query Examples

Ask from the UI:

```text
how many shipments were flagged this week?
show mismatches
how many were approved?
how many rejected shipments?
```

The query endpoint maps each question to a small allowed query intent, then runs a grounded SQLite query and shows the SQL basis in the UI. If a Gemini key is configured, Gemini can help map phrasing to the intent; the app still executes only the supported query shapes.

## Vision LLM Extraction

The extractor is provider-based. By default it uses local text extraction so the project runs without credentials. For scanned images or image-only PDFs, set a Gemini key before running the backend:

```powershell
$env:GEMINI_API_KEY="your_key"
```

The extractor will use `NOVA_EXTRACTOR_MODEL` if set, otherwise `gemini-2.5-flash`, and will fall back to local extraction if the LLM call fails. Keep API keys in environment variables only; do not commit them.

## Test

```bash
python -m unittest
cd frontend
npm run build
```

## Repo Shape

- `nova_agents/extractor.py` extracts required fields with confidence and source evidence.
- `nova_agents/validator.py` checks extracted fields against customer rules.
- `nova_agents/router.py` chooses approval, human review, or amendment request.
- `nova_agents/storage.py` persists runs in SQLite, deduplicates repeated document runs, and answers basic grounded questions.
- `app.py` exposes the Flask API and serves the built React app.
- `frontend/` contains the React operator workspace.
- `samples/` contains one clean and one messy document fixture.
