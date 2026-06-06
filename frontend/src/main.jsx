import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  Play,
  RefreshCw,
  Search,
  Upload
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "";

function App() {
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [samplePath, setSamplePath] = useState("samples/clean_invoice.txt");
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("how many shipments were flagged this week?");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const validations = run?.validations || [];
    return {
      matches: validations.filter((item) => item.status === "match").length,
      mismatches: validations.filter((item) => item.status === "mismatch").length,
      uncertain: validations.filter((item) => item.status === "uncertain").length
    };
  }, [run]);

  useEffect(() => {
    loadLatest();
  }, []);

  async function loadLatest() {
    setError("");
    const latest = await requestJson("/api/runs/latest");
    if (latest?.id) {
      setRun(latest);
    }
  }

  async function runSample(path = samplePath) {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: path })
      });
      setRun(normalizeRun(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndRun() {
    if (!file) {
      setError("Choose a PDF, image, or text document first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("customer_id", "acme-global");
      const result = await requestJson("/api/runs", { method: "POST", body: formData });
      setRun(normalizeRun(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function askQuestion() {
    setAnswer("");
    const result = await requestJson(`/api/query?q=${encodeURIComponent(question)}`);
    setAnswer(result.answer);
  }

  return (
    <main className="workspace">
      <section className="mast">
        <div>
          <p className="eyebrow">Nova · Trade Document Validation</p>
          <h1>CG document review workspace</h1>
        </div>
        <button className="ghost" onClick={loadLatest}>
          <RefreshCw size={18} /> Refresh
        </button>
      </section>

      <section className="runbar">
        <div className="uploadBox">
          <Upload size={20} />
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <button onClick={uploadAndRun} disabled={busy}>
            <FileSearch size={18} /> Validate Upload
          </button>
        </div>
        <div className="sampleBox">
          <input value={samplePath} onChange={(event) => setSamplePath(event.target.value)} />
          <button onClick={() => runSample()} disabled={busy}>
            <Play size={18} /> Run Path
          </button>
          <button className="ghost" onClick={() => runSample("samples/messy_invoice.txt")} disabled={busy}>
            <AlertTriangle size={18} /> Messy Sample
          </button>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="summary">
        <Metric label="Document" value={run?.document_name || "No run yet"} />
        <Metric label="Decision" value={run?.decision_outcome || run?.decision?.outcome || "-"} />
        <Metric label="Matched" value={counts.matches} />
        <Metric label="Issues" value={counts.mismatches + counts.uncertain} />
      </section>

      <section className="contentGrid">
        <Panel title="Extracted Fields" icon={<Database size={18} />}>
          <FieldTable rows={run?.fields || objectFields(run?.extraction?.fields)} />
        </Panel>
        <Panel title="Validation Result" icon={<CheckCircle2 size={18} />}>
          <ValidationList rows={run?.validations || []} />
        </Panel>
      </section>

      <section className="contentGrid">
        <Panel title="Decision Reasoning" icon={<FileSearch size={18} />}>
          <pre>{decisionText(run)}</pre>
        </Panel>
        <Panel title="Stored Output Query" icon={<Search size={18} />}>
          <div className="queryRow">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button onClick={askQuestion}>
              <Search size={18} /> Ask
            </button>
          </div>
          <p className="answer">{answer || "Ask about flagged, approved, or mismatched shipments."}</p>
        </Panel>
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{String(value)}</strong>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

function FieldTable({ rows }) {
  if (!rows?.length) {
    return <p className="muted">No extracted fields yet.</p>;
  }
  return (
    <div className="table">
      {rows.map((field) => (
        <div className="fieldRow" key={field.name}>
          <strong>{labelize(field.name)}</strong>
          <span>{field.value || "Missing"}</span>
          <small>{Number(field.confidence || 0).toFixed(2)}</small>
        </div>
      ))}
    </div>
  );
}

function ValidationList({ rows }) {
  if (!rows.length) {
    return <p className="muted">No validation results yet.</p>;
  }
  return (
    <div className="validationList">
      {rows.map((item) => (
        <article className={`validation ${item.status}`} key={item.field_name}>
          <div>
            <strong>{labelize(item.field_name)}</strong>
            <span>{item.reason}</span>
          </div>
          <div className="validationMeta">
            <span>{item.status}</span>
            {item.status !== "match" ? <small>Found: {item.found || "-"} · Expected: {item.expected || "-"}</small> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

async function requestJson(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function normalizeRun(result) {
  if (!result.extraction) {
    return result;
  }
  return {
    ...result,
    decision_outcome: result.decision?.outcome,
    reasoning: result.decision?.reasoning,
    draft_message: result.decision?.draft_message,
    fields: objectFields(result.extraction.fields)
  };
}

function objectFields(fields = {}) {
  return Object.values(fields || {});
}

function decisionText(run) {
  if (!run) {
    return "Run a document to see the router decision.";
  }
  const reasoning = run.reasoning || run.decision?.reasoning || "";
  const draft = run.draft_message || run.decision?.draft_message || "";
  return `${reasoning}\n\n${draft}`.trim();
}

function labelize(value) {
  return String(value || "").replaceAll("_", " ");
}

createRoot(document.getElementById("root")).render(<App />);

