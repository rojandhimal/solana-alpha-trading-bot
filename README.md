# Solana Alpha Trading Bot

Research-grade Solana token scanning, risk analysis, scoring and paper-trading platform.

> **Status:** Pre-dashboard research foundation. The read-only dashboard starts only after the documented readiness evidence gate passes. Live execution remains disabled.

## Goals

Build a multi-factor system that prioritizes liquidity, safety, trading activity, momentum, smart-money signals, market regime, strict risk controls and auditable decisions.

The project does **not** assume any score is a guaranteed probability of profit.

## Architecture

```text
Market Data -> Normalizer / Validator -> Eligibility / Safety / Liquidity / Flow / Momentum
           -> Precision Scoring -> Signal Validation -> Deterministic Risk Controls
           -> Paper Trading -> Performance / Backtesting / Walk-Forward / Robustness
           -> [PRE-DASHBOARD READINESS GATE]
           -> Read-only Dashboard

Future and separately gated:
Paper Trading -> Risk Approval -> Transaction Simulation -> Isolated Signer -> Solana
```

## Current status

The repository contains the research/backtesting foundation for historical data validation, deterministic execution modeling, portfolio accounting, walk-forward OOS evaluation, stress testing, seeded statistical robustness, stateful paper trading, idempotent paper persistence, fail-closed configuration and CI security controls.

The dashboard is **not** the validation authority. It must consume evidence and show **NOT VALIDATED** whenever required evidence is missing or failed.

## Safety principles

1. Missing, stale, malformed or out-of-order data is never silently treated as safe.
2. Hard deterministic risk controls can veto a model signal.
3. Optimization is isolated from out-of-sample evaluation.
4. Research results require provenance and reproducible configuration.
5. Private keys are forbidden in PAPER mode and are never committed.
6. LLM/model output, client requests and dashboard state cannot bypass server-side risk controls.
7. Live execution remains disabled until a separate security, key-management, paper-trading and human-authorization gate passes.

## Pre-dashboard readiness gate

See `docs/pre-dashboard-readiness.md`. The gate requires code controls **and actual evidence** from an exact release commit: clean data, multiple OOS windows, train-only optimization, parameter stability, all stress scenarios, deterministic bootstrap/Monte Carlo results, accepted paper trading, security/dependency checks, reproducible machine-readable artifacts, and green CI.

A provider outage or unavailable historical period is a failure of evidence, not a pass. The fixed 2025 DEX experiment must use a legitimate provider with the required historical coverage; no API bypass or fabricated data is acceptable.

## Development commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run research:solana:binance
```

## Data-provider roles

- **DEX research:** GeckoTerminal/Birdeye sources are intended for DEX-specific historical research where the provider legitimately supplies the required period.
- **SOL benchmark:** Binance SOLUSDT is a clearly labeled CEX benchmark, not a substitute for Raydium/DEX performance.
- **Production discovery/on-chain:** Solana RPC and discovery providers are separate from historical benchmark evidence.

## Roadmap

### Completed before dashboard

- historical data abstraction and quality validation
- deterministic baseline backtesting
- walk-forward OOS evaluation
- anti-overfitting inner validation and deterministic selection
- execution/portfolio/risk invariants
- stress testing
- bootstrap and seeded Monte Carlo robustness
- stateful paper trading and idempotent persistence contract
- security threat model, secret checks and dependency audit
- reproducible research artifact pipeline
- final pre-dashboard evidence gate

### Next: Read-only dashboard

The dashboard may visualize research evidence and paper-trading telemetry only after the pre-dashboard gate is genuinely green. It must not provide a path to live execution.

### Later: Live execution

Live execution is a separate project phase requiring transaction simulation, dynamic slippage controls, wallet isolation, secret-manager integration, emergency kill switch, independent security review, accepted paper trading and explicit human authorization.

## Risk disclaimer

This software is an engineering and research project, not financial advice. Automated trading can lose the entire trading balance. Historical or paper performance does not guarantee future results.
