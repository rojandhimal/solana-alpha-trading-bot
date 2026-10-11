# Free market data policy and verified sources

Assessment date: 11 October 2026 (Australia/Melbourne). Use public, permitted free access only. Do not buy subscriptions, add credentials, bypass provider restrictions, invent candles, or relax acceptance thresholds to accommodate a shorter dataset.

## Implemented free research path

`npm run research:solana:free-dex` uses the [GeckoTerminal public API](https://api.geckoterminal.com/docs/index.html), without an API key. The required full-year 2025 command remains `npm run research:solana`.

The supplemental experiment fixes the range to **1 May–30 September 2026**, with hourly candles for Raydium Wrapped SOL/USDC pool `58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2`. It explicitly requests Wrapped SOL, USD prices/volume, and `include_empty_intervals=false`. Response token metadata must contain the requested asset. Pages are spaced by at least 6.5 seconds; network retries and timeouts remain bounded. The public API documents approximately 10 calls/minute, subject to variation. [Public API schema](https://api.geckoterminal.com/docs/v2/swagger.json)

The period was fixed before examining its strategy results. The strategy, optimizer, 90-day training/30-day test windows, costs, stress scenarios and acceptance thresholds are unchanged. This period supplies only two complete OOS windows, below the existing five-window acceptance minimum. Its JSON report explicitly records `purpose: SUPPLEMENTAL_RECENT_DEX` and `required2025GateSatisfied: false`. Recent history cannot close the required 2025 gate.

Build and run:

```sh
npm run build
SOL_FREE_DEX_EXPERIMENT_OUTPUT=artifacts/free-dex/report.json npm run research:solana:free-dex
```

Replay the retained dataset without another network request:

```sh
SOL_FREE_DEX_DATASET_FILE=artifacts/free-dex/report.json.dataset.json SOL_FREE_DEX_EXPERIMENT_OUTPUT=artifacts/free-dex/replay.json npm run research:solana:free-dex
```

Both commands return a nonzero exit status if data validation or research acceptance fails. A report containing real data is not a readiness PASS. Artifacts preserve source identity, retrieval time, exact requested range, dataset SHA-256, configuration and code/lock identities. Existing 2025 environment variables do not change this command's period or cache.

The fixed period eventually ages beyond a rolling free-history limit. Retain the dataset cache and replay it; do not silently shift the dates or relabel another dataset. This command is supplemental research, rather than an elapsed paper-trading collector.

## Other free sources assessed

| Source | Verified free role | Limit for the required 2025 pool experiment |
| --- | --- | --- |
| Binance / Coinbase public adapters | CEX benchmark OHLCV | Cannot represent Raydium pool execution or substitute for DEX evidence. |
| DEX Screener public API | Current pool discovery and market snapshots | No documented historical OHLCV endpoint in its [public reference](https://docs.dexscreener.com/api/reference). |
| DexPaprika | Keyless hourly-or-longer pool OHLCV for the last 24 hours; a free registered key extends this to seven days | Current [endpoint documentation](https://docs.dexpaprika.com/api-reference/pools/get-ohlcv-data-for-a-pool-pair) and [plan limits](https://docs.dexpaprika.com/knowledge-base/rate-limits) do not establish free 2025 coverage. |
| Vybe | Free plan with API key, up to 48 hours of history | Its [current plans](https://docs.vybenetwork.com/docs/plans-rate-limits) do not supply the required historical range. No key was obtained. |
| Raydium API v3 | Exact legacy pool metadata and up to 30 days of TVL history, publicly reachable | TVL is not OHLCV. The [official schema](https://github.com/raydium-io/raydium-docs-v1/blob/main/api-reference/openapi/api-v3.yaml) has no general pool candle route. |
| Raydium LaunchLab history | Public candles for LaunchLab pools | This pool is a legacy AMM v4 pool. The documented kline request returned zero rows for it. [LaunchLab scope](https://github.com/raydium-io/raydium-docs-v1/blob/main/api-reference/launch-history-v1/overview.mdx) |
| TradingView official MCP | Account OAuth and Essential-or-higher subscription | Falls outside the user's free-only direction. [Official MCP access](https://www.tradingview.com/mcp/docs) |

Ordinary read-only curl requests verified Raydium metadata and 30 daily TVL points, but no usable candle history. DexPaprika returned exact-pool metadata and 21 recent hourly candles; the 2025 request returned HTTP 403 with `plan_required`, confirming its older-history limit. Its recent candle volume denomination was not certified by this audit. Initial Python requests returned HTTP 403 `error code: 1010`; successful curl requests show that those responses did not establish an authentication requirement. Observed access failures must remain separate from documented plan limits. Audit payloads, request bodies, UTC observation times, status codes and SHA-256 manifest are retained under `artifacts/free-provider-audit-2026-10-11/`; the alternative-provider digest is `alternative-provider-audit-summary.json`.

## Potential free route to older history

SQD's public Solana archive is a raw-chain source, rather than a ready OHLCV feed. Bounded public probes retrieved actual records for the exact pool on 1 January, 1 July and 31 December 2025. January’s context probe includes four committed swaps, nested SPL transfers, transaction signatures and mint/decimal metadata. This establishes a candidate for reconstruction, not a complete validated dataset. [Solana archive](https://docs.sqd.dev/en/data/solana/solana-mainnet), [Portal Solana API](https://docs.sqd.dev/en/portal/solana/api), [access limits](https://docs.sqd.dev/en/portal/pricing)

Closing the 2025 gate through this route requires bounded pagination over the complete period, decoding successful pool swaps and actual amounts, preserving instruction order, rejecting rolled-back instructions, verifying SOL/USDC orientation and volume denomination, and aggregating genuine hourly trades. A successful response can stop before the requested final slot; continuation is required. Coverage, empty trading hours and provenance must then pass the same strict audit. Archive metadata or a few sampled records cannot satisfy that gate. Verify current free research access and usage limits before any bulk extraction; no paid archive access is authorized.

SQD's published Public plan is for exploration and development/evaluation, with roughly 50 MB/month and 0.1 MB/s backfill throughput; commercial production use requires paid access. The provider says billing is not yet live and today's public limits remain until launch. These conditions permit the bounded research probes performed here, but do not establish an unrestricted free production feed. [Current pricing](https://sqd.dev/pricing/)
