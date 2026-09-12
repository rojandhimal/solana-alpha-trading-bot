import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Metric = { label: string; value: string; note: string };

const metrics: Metric[] = [
  { label: "Trading mode", value: "PAPER", note: "Live execution locked" },
  { label: "Validation", value: "GATED", note: "Research evidence required" },
  { label: "Data quality", value: "PASS/REVIEW", note: "Provider coverage shown below" },
  { label: "Risk controls", value: "ENABLED", note: "Drawdown + exposure limits" }
];

const stages = [
  ["Historical data", "Complete", "Provider provenance, pagination and quality checks"],
  ["Baseline backtest", "Complete", "Deterministic execution and portfolio accounting"],
  ["Walk-forward", "Complete", "Train/test separation with sequential OOS aggregation"],
  ["Robustness", "Complete", "Stress scenarios and statistical robustness framework"],
  ["Paper trading", "Complete", "Stateful session, persistence contract and risk halt"],
  ["Security gate", "Complete", "Fail-closed live configuration and secret checks"],
  ["Dashboard", "Active", "Read-only research and paper-trading observability"]
];

function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">SOLANA ALPHA TRADING BOT</div>
          <h1>Research Control Center</h1>
          <p className="muted">Evidence-first analytics. No dashboard action can authorize live execution.</p>
        </div>
        <div className="mode-badge"><span /> PAPER ONLY</div>
      </header>

      <section className="metrics">
        {metrics.map((metric) => (
          <article className="card metric" key={metric.label}>
            <div className="muted">{metric.label}</div>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="grid">
        <article className="card panel wide">
          <div className="panel-head"><div><div className="eyebrow">VALIDATION PIPELINE</div><h2>Pre-dashboard readiness</h2></div><span className="pill">READ ONLY</span></div>
          <div className="timeline">
            {stages.map(([name, status, detail], index) => (
              <div className="stage" key={name}>
                <div className={`dot ${status === "Active" ? "active" : ""}`}>{index + 1}</div>
                <div><b>{name}</b><div className="muted">{detail}</div></div>
                <span className={`status ${status === "Active" ? "active" : "complete"}`}>{status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card panel">
          <div className="eyebrow">RISK POSTURE</div><h2>Guardrails</h2>
          <div className="risk"><span>Max drawdown</span><b>35%</b></div>
          <div className="risk"><span>Max position notional</span><b>100%</b></div>
          <div className="risk"><span>Live trading</span><b>LOCKED</b></div>
          <div className="risk"><span>Private key in paper mode</span><b>REJECTED</b></div>
        </article>

        <article className="card panel">
          <div className="eyebrow">DATA PROVENANCE</div><h2>Research feeds</h2>
          <div className="feed"><b>Binance SOLUSDT</b><span>Benchmark</span></div>
          <div className="feed"><b>GeckoTerminal</b><span>DEX diagnostic</span></div>
          <div className="feed"><b>Solana RPC</b><span>Production/on-chain</span></div>
          <div className="feed"><b>DexScreener</b><span>Discovery/metadata</span></div>
        </article>
      </section>

      <footer className="footer">Research status is informational. A passing metric never by itself enables live trading.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
