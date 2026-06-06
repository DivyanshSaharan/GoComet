import React from "react";
import { BarChart3, Bot, Boxes, CheckCircle2, FileSearch, Route, ShieldCheck, Upload } from "lucide-react";
import { Metric, Panel } from "../components/Shared.jsx";

export function HomePage({ onStart }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Nova / Cargo Group workspace</p>
          <h1>Validate trade documents with governed agent evidence.</h1>
          <p>
            Upload invoices, run extraction and rule validation, review flagged fields, and keep every decision queryable
            for CG operations.
          </p>
          <button onClick={onStart}>
            <FileSearch size={18} /> Analyze invoices
          </button>
        </div>
        <div className="heroPanel">
          <div className="signal approved">
            <CheckCircle2 size={18} />
            Clean documents are approved automatically.
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
        <Metric icon={<Upload size={20} />} label="Input" value="Multiple invoice files" />
        <Metric icon={<Boxes size={20} />} label="Agent Chain" value="Extract / Validate / Route / Store" />
        <Metric icon={<BarChart3 size={20} />} label="Output" value="Approved and flagged counts" />
      </section>

      <section className="contentGrid">
        <Panel title="What This Dashboard Does" icon={<Bot size={18} />}>
          <div className="featureList">
            <Feature title="Analyze invoices" text="Upload one or more files, run the agent pipeline, and get approved versus flagged counts." />
            <Feature title="Review flagged invoices" text="Open a stored invoice, inspect evidence, then approve or reject it." />
            <Feature title="Search datastore" text="Filter by status, name, and date in one focused searchable table." />
          </div>
        </Panel>
        <Panel title="Decision States" icon={<ShieldCheck size={18} />}>
          <div className="statusLegend">
            <span className="pill approved">Approved</span>
            <span className="pill flagged">Flagged</span>
            <span className="pill rejected">Rejected</span>
          </div>
          <p className="muted">Perfect matches are approved automatically. Only flagged invoices expose CG actions.</p>
        </Panel>
      </section>
    </>
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

