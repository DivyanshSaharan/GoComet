import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, LoaderCircle, Send, Trash2, XCircle } from "lucide-react";
import { askDatastore, deleteRun, getRun, getRunDocument, listRuns, updateRunAction } from "../api.js";
import { DocumentEvidence, FieldTable, formatDate, statusLabel, ValidationList } from "../components/Shared.jsx";

export function DatastorePage() {
  const [filters, setFilters] = useState({ status: "", name: "", date_from: "", date_to: "" });
  const [runs, setRuns] = useState([]);
  const [openId, setOpenId] = useState("");
  const [details, setDetails] = useState({});
  const [documentTextById, setDocumentTextById] = useState({});
  const [notes, setNotes] = useState({});
  const [question, setQuestion] = useState("how many shipments were flagged this week?");
  const [queryResult, setQueryResult] = useState(null);
  const [queryBusy, setQueryBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns(nextFilters = filters) {
    setBusy(true);
    setError("");
    try {
      const result = await listRuns(nextFilters);
      setRuns(result.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRun(runId) {
    if (openId === runId) {
      setOpenId("");
      return;
    }
    setOpenId(runId);
    if (details[runId]) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const run = await getRun(runId);
      setDetails((current) => ({ ...current, [runId]: run }));
      try {
        const document = await getRunDocument(runId);
        if (document.type === "text") {
          setDocumentTextById((current) => ({ ...current, [runId]: document.content }));
        }
      } catch {
        setDocumentTextById((current) => ({ ...current, [runId]: "" }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function takeAction(runId, action) {
    setBusy(true);
    setError("");
    try {
      const updated = await updateRunAction(runId, action, notes[runId] || "");
      setDetails((current) => ({ ...current, [runId]: updated }));
      setRuns((current) => current.map((run) => run.id === runId ? { ...run, review_status: updated.review_status, action_email: updated.action_email } : run));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRun(runId) {
    const confirmed = window.confirm("Delete this invoice from the datastore?");
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteRun(runId);
      setRuns((current) => current.filter((run) => run.id !== runId));
      setDetails((current) => {
        const next = { ...current };
        delete next[runId];
        return next;
      });
      setDocumentTextById((current) => {
        const next = { ...current };
        delete next[runId];
        return next;
      });
      setOpenId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function askQuestion(event) {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }
    setQueryBusy(true);
    setError("");
    try {
      setQueryResult(await askDatastore(question.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setQueryBusy(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section className="pageHeader">
        <div>
          <p className="eyebrow">Datastore / Search invoices</p>
          <h1>Search invoices</h1>
        </div>
      </section>

      <section className="panel searchInvoices">
        <h2><Database size={18} />Search invoices</h2>
        <form className="askDatastore" onSubmit={askQuestion}>
          <div>
            <label htmlFor="datastoreQuestion">Ask datastore</label>
            <input
              id="datastoreQuestion"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="How many shipments were flagged this week?"
            />
          </div>
          <button type="submit" disabled={queryBusy}>
            {queryBusy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Ask
          </button>
        </form>
        {queryResult ? (
          <div className="queryAnswer">
            <strong>{queryResult.answer}</strong>
          </div>
        ) : null}

        <div className="filterGrid">
          <input placeholder="Invoice name" value={filters.name} onChange={(event) => updateFilter("name", event.target.value)} />
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="flagged">Flagged</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} />
          <input type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} />
          <button onClick={() => loadRuns()} disabled={busy}>Search</button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="invoiceTable">
          {runs.length ? runs.map((run) => {
            const detail = details[run.id];
            const isFlagged = (detail?.review_status || run.review_status) === "flagged";
            return (
              <article className="invoiceRow" key={run.id}>
                <button className="invoiceSummary" onClick={() => toggleRun(run.id)}>
                  <strong>{run.document_name}</strong>
                  <span className={`pill ${run.review_status}`}>{statusLabel(run.review_status)}</span>
                  <time>{formatDate(run.created_at)}</time>
                </button>
                {openId === run.id ? (
                  <div className="invoiceExpanded">
                    <p>{run.reasoning || "No reasoning stored."}</p>
                    {detail ? (
                      <div className="inlineDetails">
                        <div className="deletePanel">
                          <button className="danger" onClick={() => removeRun(run.id)} disabled={busy}>
                            <Trash2 size={18} /> Delete invoice
                          </button>
                        </div>
                        <FieldTable rows={detail.fields || []} />
                        <ValidationList rows={detail.validations || []} />
                        <DocumentEvidence run={detail} documentText={documentTextById[run.id]} />
                        {isFlagged ? (
                          <div className="actionPanel">
                            <textarea
                              value={notes[run.id] || ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [run.id]: event.target.value }))}
                              placeholder="Reviewer note for rejection email"
                            />
                            <div className="actionRow">
                              <button onClick={() => takeAction(run.id, "approved")}>
                                <CheckCircle2 size={18} /> Approve
                              </button>
                              <button className="danger" onClick={() => takeAction(run.id, "rejected")}>
                                <XCircle size={18} /> Reject
                              </button>
                            </div>
                            <div className="mailDraft">
                              <strong>Default mail draft</strong>
                              <pre>{detail.action_email || detail.draft_message || "Approve or reject to generate a supplier mail draft."}</pre>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="muted">Loading invoice details...</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          }) : <p className="muted">No invoice records match the current filters.</p>}
        </div>
      </section>
    </>
  );
}

