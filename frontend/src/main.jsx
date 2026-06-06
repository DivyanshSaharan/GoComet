import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, Database, FileSearch } from "lucide-react";
import { HomePage } from "./pages/HomePage.jsx";
import { AnalyzePage } from "./pages/AnalyzePage.jsx";
import { DatastorePage } from "./pages/DatastorePage.jsx";
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
        {page === "analyze" ? <AnalyzePage onReview={() => setPage("datastore")} /> : null}
        {page === "datastore" ? <DatastorePage /> : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

