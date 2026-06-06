import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  Database,
  FileSearch,
  LoaderCircle,
  Route,
  ShieldCheck,
  XCircle,
  Upload
} from "lucide-react";
import "./styles.css";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Bot },
  { id: "analyze", label: "Analyze", icon: FileSearch },
  { id: "datastore", label: "Datastore", icon: Database }
];

const API_BASE = import.meta.env.VITE_API_BASE || "";

function App() {
  const [page, setPage] = useState("home");

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <Bot size={24} />
          <div>
            <strong>Nova CG</strong>
            <span>Document validation</span>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`navItem ${page === item.id ? "active" : ""}`} key={item.id} onClick={() => setPage(item.id)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="page">
        {page === "home" ? <HomePage onStart={() => setPage("analyze")} /> : null}
        {page === "analyze" ? <AnalyzePage /> : null}
        {page === "datastore" ? <DatastorePage /> : null}
      </section>
    </main>
  );
}

function HomePage({ onStart }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Nova / Cargo Group workspace</p>
          <h1>Validate trade documents with governed agent evidence.</h1>
          <p>
            Upload or point to invoices, run extraction and rule validation, review flagged fields, and keep every
            decision queryable for CG operations.
          </p>
          <button onClick={onStart}>
            <FileSearch size={18} /> Analyze invoice
          </button>
        </div>
        <div className="heroPanel">
          <div className="signal approved">
            <CheckCircle2 size={18} />
            Auto-approved documents move forward.
          </div>
          <div className="signal flagged">
            <ShieldCheck size={18} />
            Flagged documents require CG review.
          </div>
          <div className="signal routed">
            <Route size={18} />
            Rejections generate supplier-ready mail drafts.
          </div>
        </div>
      </section>

      <section className="summary three">
        <Metric icon={<Upload size={20} />} label="Input" value="Path, upload, or folder" />
        <Metric icon={<Boxes size={20} />} label="Agent Chain" value="Extract / Validate / Route / Store" />
        <Metric icon={<BarChart3 size={20} />} label="Output" value="Status, evidence, and searchable records" />
      </section>

      <section className="contentGrid">
        <Panel title="What This Dashboard Does" icon={<Bot size={18} />}>
          <div className="featureList">
            <Feature title="Analyze one invoice" text="Inspect extracted fields, validation status, evidence snippets, and CG actions." />
            <Feature title="Analyze a folder" text="Run a batch and summarize approved versus flagged documents." />
            <Feature title="Search datastore" text="Filter by status, name, and date, then open detailed invoice reports." />
          </div>
        </Panel>
        <Panel title="Decision States" icon={<ShieldCheck size={18} />}>
          <div className="statusLegend">
            <span className="pill approved">Approved</span>
            <span className="pill flagged">Flagged</span>
            <span className="pill rejected">Rejected</span>
          </div>
          <p className="muted">CG can approve flagged documents, reject with a default supplier email, or close a report after review.</p>
        </Panel>
      </section>
    </>
  );
}

function AnalyzePage() {
  const [path, setPath] = useState("samples/clean_invoice.txt");
  const [folder, setFolder] = useState("samples");
  const [file, setFile] = useState(null);
  const [run, setRun] = useState(null);
  const [batch, setBatch] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function analyzePath(nextPath = path) {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: nextPath })
      });
      await setCurrentRun(normalizeRun(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeUpload() {
    if (!file) {
      setError("Choose a document first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("document", file);
      const result = await requestJson("/api/runs", { method: "POST", body: formData });
      await setCurrentRun(normalizeRun(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function takeAction(action) {
    if (!run?.id) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await requestJson(`/api/runs/${run.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note })
      });
      setRun(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeFolder() {
    setBusy(true);
    setError("");
    setBatch(null);
    try {
      const result = await requestJson("/api/batch-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder })
      });
      setBatch(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setCurrentRun(nextRun) {
    setRun(nextRun);
    setDocumentText("");
    if (!nextRun?.id) {
      return;
    }
    try {
      const document = await requestJson(`/api/runs/${nextRun.id}/document`);
      if (document.type === "text") {
        setDocumentText(document.content);
      }
    } catch {
      setDocumentText("");
    }
  }

  return (
    <>
      {busy ? (
        <div className="processingBanner">
          <LoaderCircle className="spin" size={18} />
          Running invoice analysis
        </div>
      ) : null}
      <section className="pageHeader">
        <div>
          <p className="eyebrow">Analyze / Single and batch</p>
          <h1>Review one invoice or process a folder.</h1>
        </div>
      </section>

      <section className="runbar">
        <div className="sampleBox">
          <input value={path} onChange={(event) => setPath(event.target.value)} />
          <button onClick={() => analyzePath()} disabled={busy}>
            <FileSearch size={18} /> Analyze Path
          </button>
          <button className="ghost" onClick={() => analyzePath("samples/messy_invoice.txt")} disabled={busy}>
            <ShieldCheck size={18} /> Messy Sample
          </button>
        </div>
        <div className="uploadBox">
          <Upload size={20} />
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <button onClick={analyzeUpload} disabled={busy}>
            <Upload size={18} /> Analyze Upload
          </button>
        </div>
      </section>

      <section className="panel batchPanel">
        <h2><Boxes size={18} />Analyze multiple invoices</h2>
        <div className="sampleBox">
          <input value={folder} onChange={(event) => setFolder(event.target.value)} />
          <button onClick={analyzeFolder} disabled={busy}>
            <Boxes size={18} /> Analyze Folder
          </button>
        </div>
        <BatchSummary batch={batch} />
      </section>

      {error ? <div className="error">{error}</div> : null}

      <RunSummary run={run} />

      <section className="contentGrid">
        <Panel title="Invoice Details" icon={<Database size={18} />}>
          <FieldTable rows={run?.fields || objectFields(run?.extraction?.fields)} />
        </Panel>
        <Panel title="Validation Result" icon={<CheckCircle2 size={18} />}>
          <ValidationList rows={run?.validations || []} />
        </Panel>
      </section>

      <section className="contentGrid">
        <Panel title="Source & Evidence" icon={<FileSearch size={18} />}>
          <DocumentEvidence run={run} documentText={documentText} />
        </Panel>
        <Panel title="CG Action" icon={<Route size={18} />}>
          <ActionPanel run={run} note={note} setNote={setNote} onAction={takeAction} />
        </Panel>
      </section>
    </>
  );
}

function DatastorePage() {
  return (
    <section className="placeholder panel">
      <h2><Database size={18} />Datastore</h2>
      <p className="muted">Searchable invoice records and action controls will be added in the final dashboard commit.</p>
    </section>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric neutral">
      <span>{icon}{label}</span>
      <strong>{value}</strong>
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

function Feature({ title, text }) {
  return (
    <article className="feature">
      <strong>{title}</strong>
      <span>{text}</span>
    </article>
  );
}

function RunSummary({ run }) {
  return (
    <section className="summary">
      <Metric icon={<FileSearch size={20} />} label="Document" value={run?.document_name || "No report open"} />
      <Metric icon={<ShieldCheck size={20} />} label="Status" value={statusLabel(run?.review_status)} />
      <Metric icon={<CheckCircle2 size={20} />} label="Decision" value={run?.decision_outcome || run?.decision?.outcome || "-"} />
      <Metric icon={<XCircle size={20} />} label="Closed" value={run?.closed_at ? "Yes" : "No"} />
    </section>
  );
}

function FieldTable({ rows }) {
  if (!rows?.length) {
    return <p className="muted">Run an invoice to see extracted fields.</p>;
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
  if (!rows?.length) {
    return <p className="muted">No validation result yet.</p>;
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
            {item.status !== "match" ? <small>Found: {item.found || "-"} / Expected: {item.expected || "-"}</small> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function DocumentEvidence({ run, documentText }) {
  const issues = (run?.validations || []).filter((item) => item.status !== "match");
  if (!run) {
    return <p className="muted">Run an invoice to inspect source text and evidence snippets.</p>;
  }
  return (
    <div className="evidenceStack">
      <div className="documentPreview">
        {documentText ? <pre>{documentText}</pre> : <p className="muted">Text preview is available for text-like documents. Snippets are shown below.</p>}
      </div>
      <div className="snippetList">
        <strong>Problem Evidence</strong>
        {issues.length ? (
          issues.map((item) => (
            <article className="snippet" key={item.field_name}>
              <span>{labelize(item.field_name)}</span>
              <small>{item.source_snippet || "No source snippet captured."}</small>
            </article>
          ))
        ) : (
          <p className="muted">No field-level issues for this invoice.</p>
        )}
      </div>
    </div>
  );
}

function ActionPanel({ run, note, setNote, onAction }) {
  if (!run) {
    return <p className="muted">Open a report to approve, reject, or close it.</p>;
  }
  return (
    <div className="actionPanel">
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reviewer note for rejection email or audit trail" />
      <div className="actionRow">
        <button onClick={() => onAction("approved")}>
          <CheckCircle2 size={18} /> Approve
        </button>
        <button className="danger" onClick={() => onAction("rejected")}>
          <XCircle size={18} /> Reject
        </button>
        <button className="ghost" onClick={() => onAction("close")}>
          Close Report
        </button>
      </div>
      <div className="mailDraft">
        <strong>Default mail draft</strong>
        <pre>{run.action_email || run.draft_message || run.decision?.draft_message || "Approve or reject to generate a supplier mail draft."}</pre>
      </div>
    </div>
  );
}

function BatchSummary({ batch }) {
  if (!batch) {
    return <p className="muted">Run a folder to see batch totals for approved, flagged, and rejected invoices.</p>;
  }
  return (
    <>
      <section className="summary batchSummary">
        <Metric icon={<Boxes size={20} />} label="Total" value={batch.total} />
        <Metric icon={<CheckCircle2 size={20} />} label="Approved" value={batch.approved} />
        <Metric icon={<ShieldCheck size={20} />} label="Flagged" value={batch.flagged} />
        <Metric icon={<XCircle size={20} />} label="Rejected" value={batch.rejected} />
      </section>
      <div className="batchList">
        {batch.runs.map((item) => (
          <div className="batchRow" key={item.id}>
            <strong>{item.document_name}</strong>
            <span className={`pill ${item.review_status}`}>{statusLabel(item.review_status)}</span>
          </div>
        ))}
      </div>
    </>
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

function statusLabel(status) {
  if (!status) {
    return "-";
  }
  return status.replaceAll("_", " ");
}

function labelize(value) {
  return String(value || "").replaceAll("_", " ");
}

createRoot(document.getElementById("root")).render(<App />);
