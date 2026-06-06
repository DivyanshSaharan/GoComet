import React, { useState } from "react";
import { CheckCircle2, Database, FileSearch, LoaderCircle, ShieldCheck, Upload, XCircle } from "lucide-react";
import { analyzeFile } from "../api.js";
import { Metric } from "../components/Shared.jsx";

const MIN_PROCESSING_MS = 10000;

export function AnalyzePage({ onReview }) {
  const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState("upload");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function chooseFiles(event) {
    setFiles(Array.from(event.target.files || []));
    setResult(null);
    setError("");
  }

  async function analyzeSelectedFiles() {
    if (!files.length) {
      setError("Upload at least one invoice before analyzing.");
      return;
    }
    setPhase("processing");
    setError("");
    const startedAt = Date.now();
    try {
      const runs = [];
      for (const file of files) {
        runs.push(await analyzeFile(file));
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_PROCESSING_MS) {
        await delay(MIN_PROCESSING_MS - elapsed);
      }
      setResult({
        approved: runs.filter((run) => run.review_status === "approved").length,
        flagged: runs.filter((run) => run.review_status === "flagged").length,
        rejected: runs.filter((run) => run.review_status === "rejected").length,
        rejectedDuplicate: runs.length === 1 && runs[0].review_status === "rejected" && runs[0].reused_existing
      });
      setPhase("complete");
    } catch (err) {
      setError(err.message);
      setPhase("upload");
    }
  }

  if (phase === "processing") {
    return (
      <section className="processingPage">
        <LoaderCircle className="spin" size={42} />
        <h1>Processing invoices</h1>
        <p>Extractor, validator, router, and datastore agents are running.</p>
      </section>
    );
  }

  if (phase === "complete" && result) {
    if (result.rejectedDuplicate || (result.rejected > 0 && result.approved === 0 && result.flagged === 0)) {
      return (
        <section className="analysisComplete">
          <div className="resultOnly single">
            <Metric icon={<XCircle size={22} />} label="Rejected" value="Already processed and rejected" tone="bad" />
          </div>
          <ReviewCta onReview={onReview} />
        </section>
      );
    }
    return (
      <section className="analysisComplete">
        <div className="resultOnly">
          <Metric icon={<CheckCircle2 size={22} />} label="Auto Approved" value={result.approved} tone="good" />
          <Metric icon={<ShieldCheck size={22} />} label="Flagged" value={result.flagged} tone={result.flagged ? "warn" : "good"} />
        </div>
        <ReviewCta onReview={onReview} />
      </section>
    );
  }

  return (
    <>
      <section className="pageHeader">
        <div>
          <p className="eyebrow">Analyze / Upload invoices</p>
          <h1>Upload invoices, then run analysis.</h1>
        </div>
      </section>

      <section className="panel uploadWorkflow">
        <h2><Upload size={18} />Step 1: Upload invoice files</h2>
        <input type="file" multiple onChange={chooseFiles} />
        <div className="selectedFiles">
          {files.length ? files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>) : <p className="muted">No files selected yet.</p>}
        </div>
        <h2><FileSearch size={18} />Step 2: Analyze uploaded files</h2>
        <button onClick={analyzeSelectedFiles}>
          <FileSearch size={18} /> Analyze
        </button>
      </section>

      {error ? <div className="error">{error}</div> : null}
    </>
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ReviewCta({ onReview }) {
  return (
    <div className="reviewCta">
      <p>Open Datastore to review flagged or rejected invoices and take CG action.</p>
      <button onClick={onReview}>
        <Database size={18} /> Go to Datastore
      </button>
    </div>
  );
}

