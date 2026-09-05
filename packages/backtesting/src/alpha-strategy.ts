export interface StrategyCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyFeatures {
  fastEma: number;
  slowEma: number;
  rsi: number;
  atr: number;
  momentumPct: number;
  volumeRatio: number;
}

export type SignalSide = "LONG" | "SHORT" | "FLAT";

export interface StrategySignal {
  side: SignalSide;
  score: number;
  features: StrategyFeatures;
}

export interface AlphaStrategyConfig {
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  momentumPeriod: number;
  atrPeriod: number;
  volumePeriod: number;
  entryThreshold: number;
}

const DEFAULT_CONFIG: AlphaStrategyConfig = {
  fastPeriod: 10,
  slowPeriod: 30,
  rsiPeriod: 14,
  momentumPeriod: 10,
  atrPeriod: 14,
  volumePeriod: 20,
  entryThreshold: 0.5
};

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ema(values: readonly number[], period: number): number {
  if (values.length === 0) return 0;
  const alpha = 2 / (period + 1);
  let result = values[0] ?? 0;
  for (let i = 1; i < values.length; i += 1) result = alpha * (values[i] ?? result) + (1 - alpha) * result;
  return result;
}

function rsi(closes: readonly number[], period: number): number {
  if (closes.length <= period) return 50;
  const changes = closes.slice(1).map((close, i) => close - (closes[i] ?? close));
  const window = changes.slice(-period);
  const gains = average(window.map((change) => Math.max(change, 0)));
  const losses = average(window.map((change) => Math.max(-change, 0)));
  if (losses === 0) return gains > 0 ? 100 : 50;
  return 100 - 100 / (1 + gains / losses);
}

function atr(candles: readonly StrategyCandle[], period: number): number {
  if (candles.length < 2) return 0;
  const ranges = candles.slice(1).map((candle, i) => {
    const previousClose = candles[i]?.close ?? candle.close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  return average(ranges.slice(-period));
}

function validateConfig(config: AlphaStrategyConfig): void {
  for (const [name, value] of Object.entries(config)) {
    if (name !== "entryThreshold" && (!Number.isInteger(value) || value <= 0)) throw new Error(`${name} must be a positive integer`);
  }
  if (config.entryThreshold <= 0 || config.entryThreshold > 1) throw new Error("entryThreshold must be > 0 and <= 1");
}

export function calculateFeatures(candles: readonly StrategyCandle[], config: AlphaStrategyConfig = DEFAULT_CONFIG): StrategyFeatures {
  validateConfig(config);
  const closes = candles.map((candle) => candle.close);
  const fastEma = ema(closes.slice(-config.slowPeriod * 3), config.fastPeriod);
  const slowEma = ema(closes.slice(-config.slowPeriod * 3), config.slowPeriod);
  const current = closes.at(-1) ?? 0;
  const prior = closes.at(-(config.momentumPeriod + 1)) ?? current;
  const volumeWindow = candles.slice(-config.volumePeriod).map((candle) => candle.volume);
  const averageVolume = average(volumeWindow);
  return {
    fastEma,
    slowEma,
    rsi: rsi(closes, config.rsiPeriod),
    atr: atr(candles, config.atrPeriod),
    momentumPct: prior === 0 ? 0 : ((current - prior) / prior) * 100,
    volumeRatio: averageVolume === 0 ? 0 : current === 0 ? 0 : (candles.at(-1)?.volume ?? 0) / averageVolume
  };
}

export function generateSignal(candles: readonly StrategyCandle[], config: AlphaStrategyConfig = DEFAULT_CONFIG): StrategySignal {
  const features = calculateFeatures(candles, config);
  const trend = features.fastEma > features.slowEma ? 0.35 : features.fastEma < features.slowEma ? -0.35 : 0;
  const momentum = features.momentumPct > 0 ? 0.25 : features.momentumPct < 0 ? -0.25 : 0;
  const oscillator = features.rsi >= 55 ? 0.2 : features.rsi <= 45 ? -0.2 : 0;
  const volume = features.volumeRatio >= 1 ? (trend >= 0 ? 0.2 : -0.2) : 0;
  const score = trend + momentum + oscillator + volume;
  const side: SignalSide = score >= config.entryThreshold ? "LONG" : score <= -config.entryThreshold ? "SHORT" : "FLAT";
  return { side, score, features };
}
