# Solana Alpha Trading Bot

Research-grade Solana token scanning, risk analysis, scoring and paper-trading platform.

> **Status:** Phase A/B foundation. Paper trading only. Live execution is intentionally not implemented in this initial release.

## Goals

Build a multi-factor system that prioritizes:

- liquidity and exitability
- token/program safety
- holder concentration
- trading activity and momentum
- smart-money signals
- market regime
- strict risk controls
- auditable decisions

The project does **not** assume any score is a guaranteed probability of profit.

## Architecture

```text
Market Data
    |
    v
Normalizer / Validator
    |
    v
Eligibility Gate
    |
    +--> Safety Engine
    +--> Liquidity Engine
    +--> Holder Engine
    +--> Flow Engine
    +--> Momentum Engine
    +--> Smart-Money Engine
    +--> Market-Regime Engine
    |
    v
Precision Scoring Engine
    |
    v
Signal Validator
    |
    v
Risk Engine
    |
    v
Paper Trading
    |
    v
Performance / Backtesting

Future:
Paper Trading --> Risk Approval --> Jupiter Execution --> Solana
```

## Current release

Phase A/B contains:

- TypeScript monorepo structure
- strict compiler configuration
- validated environment configuration
- PostgreSQL + Redis Docker services
- structured logging
- DEX Screener client abstraction
- normalized token-pair model
- conservative eligibility filtering
- unit tests for initial eligibility rules
- paper-trading-only configuration

## Safety principles

1. Missing or stale data is not treated as safe.
2. Hard rejection rules can veto a high composite score.
3. Live trading must remain disabled until safety, backtesting, paper trading and risk controls are validated.
4. Private keys and secrets must never be committed.
5. External API responses are parsed into internal types before use.
6. Every trade decision should be explainable and auditable.

## Requirements

- Node.js 20+
- npm 10+
- Docker / Docker Compose
- A Solana RPC endpoint for expanded on-chain analysis

## Setup

```bash
git clone https://github.com/rojandhimal/solana-alpha-trading-bot.git
cd solana-alpha-trading-bot
npm install
cp .env.example .env
docker compose up -d
```

Then verify PostgreSQL and Redis:

```bash
docker compose ps
```

## Environment

Copy `.env.example` to `.env` and update values as required.

Important defaults:

```env
LIVE_TRADING=false
TRADING_MODE=PAPER
RPC_ENDPOINT=https://api.mainnet-beta.solana.com
MIN_LIQUIDITY_USD=100000
MIN_VOLUME_24H_USD=500000
MIN_SIGNAL_SCORE=80
```

`LIVE_TRADING` is an explicit kill-switch and defaults to `false`. If `TRADING_MODE=LIVE` and `LIVE_TRADING` is not `true`, the app exits before running.

Never commit private keys or mnemonics. Keep them only in local environment variables or GitHub Actions Secrets.

## Development commands

```bash
npm run build
npm test
npm run audit:ci
npm run format
```

Scanner development will be enabled as the workspace applications are expanded.

## Roadmap

### Phase A - Foundation

- configuration
- logging
- database
- Redis
- testing
- Docker

### Phase B - Market data

- token discovery
- pair discovery
- price/volume/liquidity snapshots
- data quality checks

### Phase C - Safety

- SPL Token / Token-2022 inspection
- mint and freeze authority checks
- extension analysis
- holder concentration
- developer wallet analysis
- liquidity and exit simulation

### Phase D - Intelligence

- momentum
- buy/sell pressure
- wallet reputation
- smart-money tracking
- market regime
- 0-100 composite scoring
- confidence and data-quality scores

### Phase E - Paper trading

- simulated wallet
- entries/exits
- fees
- slippage
- stop loss
- take profit
- trailing stop
- portfolio accounting

### Phase F - Research

- historical replay
- walk-forward validation
- out-of-sample testing
- parameter stability
- drawdown and expectancy analysis

### Phase G - Live execution

Only after validation:

- transaction simulation
- dynamic slippage controls
- Jupiter execution
- wallet isolation
- emergency kill switch
- live monitoring

## Risk disclaimer

This software is an engineering and research project, not financial advice. Automated trading can lose the entire trading balance. A high score is not a guarantee of a profitable trade.

## License

TBD
