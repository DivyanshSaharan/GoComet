import React from "react";

export function Panel({ title, icon, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <h2>{icon}{title}</h2>
      {children}
    </section>
  );
}

export function Metric({ icon, label, value, tone = "neutral" }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{icon}{label}</span>
      <strong>{String(value)}</strong>
    </div>
  );
}

export function FieldTable({ rows }) {
  if (!rows?.length) {
    return <p className="muted">No extracted fields available.</p>;
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

export function ValidationList({ rows }) {
  if (!rows?.length) {
    return <p className="muted">No validation result available.</p>;
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

export function DocumentEvidence({ run, documentText, documentUrl }) {
  const issues = (run?.validations || []).filter((item) => item.status !== "match");
  const documentName = run?.document_path || run?.document_name || "";
  const lowerName = documentName.toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((suffix) => lowerName.endsWith(suffix));
  const isPdf = lowerName.endsWith(".pdf");
  return (
    <div className="evidenceStack">
      <div className="documentPreview">
        <div className="previewHeader">
          <strong>Source document</strong>
          {documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer">Open full document</a> : null}
        </div>
        {documentText ? <pre>{documentText}</pre> : null}
        {!documentText && isImage ? <img src={documentUrl} alt={run.document_name || "Source document"} /> : null}
        {!documentText && isPdf ? <iframe title={run.document_name || "Source document"} src={documentUrl} /> : null}
        {!documentText && !isImage && !isPdf ? <p className="muted">Preview is unavailable for this file type. Use the full document link above.</p> : null}
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

export function statusLabel(status) {
  if (!status) {
    return "-";
  }
  return String(status).replaceAll("_", " ");
}

export function labelize(value) {
  return String(value || "").replaceAll("_", " ");
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString();
}

export function objectFields(fields = {}) {
  return Object.values(fields || {});
}

export function normalizeRun(result) {
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

