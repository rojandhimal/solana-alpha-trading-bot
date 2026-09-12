export type StressScenario = "BASE" | "HIGH_SLIPPAGE" | "HIGH_FEES" | "LIQUIDITY_SHOCK" | "EXECUTION_DELAY" | "VOLATILITY_SHOCK";

export interface StressParameters {
  slippageMultiplier: number;
  feeMultiplier: number;
  liquidityMultiplier: number;
  executionDelayBars: number;
  volatilityMultiplier: number;
}

export interface StressMetrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  profitFactor: number;
  expectancy: number;
}

export interface StressScenarioResult {
  scenario: StressScenario;
  parameters: StressParameters;
  metrics: StressMetrics;
}

const SCENARIOS: Record<StressScenario, StressParameters> = {
  BASE: { slippageMultiplier: 1, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 },
  HIGH_SLIPPAGE: { slippageMultiplier: 2, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 },
  HIGH_FEES: { slippageMultiplier: 1, feeMultiplier: 2, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 1 },
  LIQUIDITY_SHOCK: { slippageMultiplier: 3, feeMultiplier: 1, liquidityMultiplier: 0.5, executionDelayBars: 0, volatilityMultiplier: 1 },
  EXECUTION_DELAY: { slippageMultiplier: 1, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 2, volatilityMultiplier: 1 },
  VOLATILITY_SHOCK: { slippageMultiplier: 1.5, feeMultiplier: 1, liquidityMultiplier: 1, executionDelayBars: 0, volatilityMultiplier: 2 }
};

export function getStressParameters(scenario: StressScenario): StressParameters {
  return { ...SCENARIOS[scenario] };
}

export function runStressScenarios(
  scenarios: readonly StressScenario[],
  run: (parameters: StressParameters, scenario: StressScenario) => StressMetrics
): StressScenarioResult[] {
  return scenarios.map((scenario) => {
    const parameters = getStressParameters(scenario);
    return { scenario, parameters, metrics: run(parameters, scenario) };
  });
}
