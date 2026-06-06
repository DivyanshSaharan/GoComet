import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  Database,
  FileSearch,
  Route,
  ShieldCheck,
  Upload
} from "lucide-react";
import "./styles.css";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Bot },
  { id: "analyze", label: "Analyze", icon: FileSearch },
  { id: "datastore", label: "Datastore", icon: Database }
];

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
  return (
    <section className="placeholder panel">
      <h2><FileSearch size={18} />Analyze</h2>
      <p className="muted">Single-invoice and batch analysis workflows will be added in the next commits.</p>
    </section>
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

createRoot(document.getElementById("root")).render(<App />);

