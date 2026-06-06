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

export function DocumentEvidence({ run, documentText }) {
  const issues = (run?.validations || []).filter((item) => item.status !== "match");
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

