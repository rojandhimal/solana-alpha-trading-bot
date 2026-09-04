export type SafetySeverity = "INFO" | "WARN" | "CRITICAL";

export interface TokenSafetySnapshot {
  tokenAddress: string;
  tokenProgram: "SPL_TOKEN" | "TOKEN_2022" | "UNKNOWN";
  mintAuthority: string | null;
  freezeAuthority: string | null;
  permanentDelegate: string | null;
  transferFeeBps: number | null;
  transferFeeMaxAmount: bigint | null;
  pausable: boolean | null;
  defaultAccountState: "INITIALIZED" | "FROZEN" | null;
  metadataMutable: boolean | null;
}

export interface SafetyFinding {
  code: string;
  severity: SafetySeverity;
  message: string;
}

export interface SafetyAssessment {
  score: number;
  decision: "PASS" | "WARN" | "REJECT";
  findings: SafetyFinding[];
}
