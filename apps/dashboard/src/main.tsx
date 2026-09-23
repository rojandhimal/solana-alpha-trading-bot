import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Check = { key: string; label: string; description: string; verified: boolean };
const checks: Check[] = [
  ["dataProvenance","Data provenance","Source, symbol/pool, interval and period are pinned",false],
  ["dataQuality","Data quality","No unresolved duplicate, ordering, OHLC, volume, gap or coverage failures",false],
  ["freshness","Freshness","Paper/live ingestion rejects stale and out-of-order data",false],
  ["executionInvariants","Execution invariants","Fills and accounting obey deterministic execution rules",false],
  ["riskInvariants","Risk invariants","Exposure limits and halt behavior are enforced before new exposure",false],
  ["stateIdempotency","State / idempotency","Replay and persistence reconcile deterministically",false],
  ["walkForwardOos","Walk-forward OOS","Multiple non-overlapping sequential OOS windows are verified",false],
  ["antiOverfitting","Anti-overfitting","Inner validation and deterministic parameter selection are verified",false],
  ["stress","Stress testing","All configured execution stress scenarios have evidence",false],
  ["statisticalRobustness","Statistical robustness","Seeded bootstrap and Monte Carlo evidence is present",false],
  ["paperAcceptance","Paper acceptance","Declared paper-trading acceptance period and regimes are satisfied",false],
  ["security","Security","Dependency, secret, configuration and threat-model gates are green",false],
  ["reproducibility","Reproducibility","Pinned lockfile and deterministic research artifact are present",false],
  ["ci","CI","Typecheck, tests, build, security and evidence jobs are green",false]
].map(([key,label,description,verified])=>({key,label,description,verified}));

function App() {
  const [tab,setTab]=useState("Overview");
  const verified=useMemo(()=>checks.filter(c=>c.verified).length,[ ]);
  const tabs=["Overview","Validation","Risk","Data"];
  return <main className="shell">
    <header className="topbar">
      <div><div className="eyebrow">SOLANA ALPHA TRADING BOT</div><h1>Research Control Center</h1><p className="muted">Read-only observability for research evidence and paper trading. No dashboard action can authorize live execution.</p></div>
      <div className="mode-badge"><span/> PAPER ONLY</div>
    </header>
    <nav className="tabs">{tabs.map(t=><button className={tab===t?"tab active":"tab"} onClick={()=>setTab(t)} key={t}>{t}</button>)}</nav>

    {tab==="Overview" && <section>
      <div className="hero card"><div><div className="eyebrow">PRE-DASHBOARD GATE</div><h2>NOT VALIDATED</h2><p className="muted">The dashboard intentionally remains non-authoritative until a single release commit has complete, reproducible evidence.</p></div><div className="gate-ring"><b>{verified}</b><span>/ {checks.length} checks</span></div></div>
      <div className="metrics">
        <Metric label="Trading mode" value="PAPER" note="Live execution locked"/>
        <Metric label="Readiness" value="NOT VALIDATED" note="Missing evidence cannot be treated as a pass"/>
        <Metric label="Evidence" value={verified+"/"+checks.length} note="Verified readiness checks"/>
        <Metric label="Signer access" value="BLOCKED" note="Paper mode rejects private keys"/>
      </div>
      <div className="grid">
        <Panel title="Validation pipeline" eyebrow="RELEASE GATE" wide>
          {checks.map((c,i)=><div className="stage" key={c.key}><div className="dot">{i+1}</div><div><b>{c.label}</b><div className="muted">{c.description}</div></div><span className="status pending">PENDING</span></div>)}
        </Panel>
        <Panel title="Risk posture" eyebrow="DETERMINISTIC GUARDRAILS">
          <Row a="Max drawdown" b="35%"/><Row a="Max position notional" b="100%"/><Row a="Live trading" b="LOCKED"/><Row a="Dashboard authority" b="NONE"/>
        </Panel>
        <Panel title="Research sources" eyebrow="PROVENANCE">
          <Row a="Binance SOLUSDT" b="CEX benchmark"/><Row a="GeckoTerminal" b="DEX diagnostic"/><Row a="Solana RPC" b="On-chain"/><Row a="DexScreener" b="Discovery"/>
        </Panel>
      </div>
    </section>}

    {tab==="Validation" && <section className="card panel"><div className="eyebrow">EVIDENCE MATRIX</div><h2>Release checks</h2>{checks.map(c=><div className="check" key={c.key}><span className="check-icon">—</span><div><b>{c.label}</b><div className="muted">{c.description}</div></div><span className="status pending">NOT VERIFIED</span></div>)}<p className="callout">A dashboard view can display evidence, but it cannot turn missing evidence into a passing state.</p></section>}

    {tab==="Risk" && <section className="grid single"><Panel title="Risk controls" eyebrow="PAPER TRADING ONLY"><Row a="Maximum drawdown" b="35%"/><Row a="Maximum position notional" b="100% of marked equity"/><Row a="After halt" b="No new exposure; reductions allowed"/><Row a="Private key in PAPER" b="Rejected"/><Row a="LIVE enablement" b="Explicit fail-closed configuration"/></Panel><Panel title="Security boundary" eyebrow="NON-BYPASSABLE"><p className="muted">Client state, dashboard state, external model output and untrusted market data must not bypass deterministic server-side risk controls.</p></Panel></section>}

    {tab==="Data" && <section className="grid single"><Panel title="Provider separation" eyebrow="DATA PROVENANCE"><Row a="DEX historical research" b="GeckoTerminal / legitimate licensed source"/><Row a="SOL benchmark" b="Binance SOLUSDT"/><Row a="Production on-chain" b="Solana RPC"/><Row a="Discovery / metadata" b="DexScreener"/></Panel><Panel title="Current evidence blocker" eyebrow="IMPORTANT"><p className="muted">The public GeckoTerminal endpoint does not provide the fixed 2025 historical period required for the DEX experiment. This is recorded as missing evidence, not silently substituted or bypassed.</p></Panel></section>}

    <footer className="footer">Research status is informational. Historical or paper performance is not a guarantee of future results. Live execution remains disabled.</footer>
  </main>;
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="card metric"><div className="muted">{label}</div><strong>{value}</strong><small>{note}</small></article>}
function Panel({title,eyebrow,children,wide=false}:{title:string;eyebrow:string;children:React.ReactNode;wide?:boolean}){return <article className={wide?"card panel wide":"card panel"}><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{children}</article>}
function Row({a,b}:{a:string;b:string}){return <div className="row"><span>{a}</span><b>{b}</b></div>}
createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);
