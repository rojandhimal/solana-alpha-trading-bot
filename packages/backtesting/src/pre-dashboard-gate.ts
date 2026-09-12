export interface PreDashboardGateInput {
  dataQualityPassed: boolean;
  walkForwardPassed: boolean;
  robustnessPassed: boolean;
  statisticalTestsPassed: boolean;
  paperTradingReady: boolean;
  reconciliationPassed: boolean;
  securityPassed: boolean;
  ciPassed: boolean;
  liveTradingDisabled: boolean;
  provenanceDocumented: boolean;
}

export interface PreDashboardGateResult {
  ready: boolean;
  blockers: string[];
}

export function evaluatePreDashboardGate(input: PreDashboardGateInput): PreDashboardGateResult {
  const checks: Array<[keyof PreDashboardGateInput, string]> = [
    ["dataQualityPassed", "historical data quality is not validated"],
    ["walkForwardPassed", "walk-forward out-of-sample validation is not passed"],
    ["robustnessPassed", "stress/robustness validation is not passed"],
    ["statisticalTestsPassed", "statistical robustness tests are not passed"],
    ["paperTradingReady", "paper-trading readiness is not passed"],
    ["reconciliationPassed", "execution reconciliation/idempotency is not passed"],
    ["securityPassed", "security checks are not passed"],
    ["ciPassed", "CI is not green"],
    ["liveTradingDisabled", "live trading is not fail-closed disabled"],
    ["provenanceDocumented", "data provenance is not documented"]
  ];

  const blockers = checks.filter(([key]) => !input[key]).map(([, message]) => message);
  return { ready: blockers.length === 0, blockers };
}
