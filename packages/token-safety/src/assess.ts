import { config } from "@alpha/config";
import type { SafetyAssessment, SafetyFinding, TokenSafetySnapshot } from "./types.js";

function add(
  findings: SafetyFinding[],
  code: string,
  severity: SafetyFinding["severity"],
  message: string,
): void {
  findings.push({ code, severity, message });
}

/**
 * Conservative policy layer. This evaluates already-validated token facts;
 * it deliberately does not pretend that missing on-chain data is safe.
 */
export function assessTokenSafety(snapshot: TokenSafetySnapshot): SafetyAssessment {
  const findings: SafetyFinding[] = [];
  let score = 100;

  if (snapshot.tokenProgram === "UNKNOWN") {
    add(findings, "UNKNOWN_TOKEN_PROGRAM", "CRITICAL", "Token program could not be verified.");
    score -= 40;
  }

  if (snapshot.mintAuthority !== null) {
    add(findings, "MINT_AUTHORITY_ACTIVE", "WARN", "Mint authority is active; supply can potentially be changed.");
    score -= 12;
  } else {
    add(findings, "MINT_AUTHORITY_REVOKED", "INFO", "Mint authority is not active.");
  }

  if (snapshot.freezeAuthority !== null) {
    add(findings, "FREEZE_AUTHORITY_ACTIVE", "CRITICAL", "Freeze authority is active.");
    score -= 30;
  } else {
    add(findings, "FREEZE_AUTHORITY_REVOKED", "INFO", "Freeze authority is not active.");
  }

  if (snapshot.permanentDelegate !== null) {
    add(findings, "PERMANENT_DELEGATE", "CRITICAL", "Permanent delegate is present and requires additional risk review.");
    score -= 30;
  }

  if (snapshot.transferFeeBps !== null && snapshot.transferFeeBps > 0) {
    const maxAllowedBps = Math.round(config.MAX_EXPECTED_SLIPPAGE_PERCENT * 100);
    if (snapshot.transferFeeBps > maxAllowedBps) {
      add(findings, "HIGH_TRANSFER_FEE", "CRITICAL", "Transfer fee exceeds the configured execution-risk threshold.");
      score -= 25;
    } else {
      add(findings, "TRANSFER_FEE", "WARN", "Token has a non-zero transfer fee.");
      score -= 8;
    }
  }

  if (snapshot.pausable === true) {
    add(findings, "PAUSABLE_TOKEN", "CRITICAL", "Token transfers can potentially be paused.");
    score -= 25;
  } else if (snapshot.pausable === null && snapshot.tokenProgram === "TOKEN_2022") {
    add(findings, "PAUSABLE_STATE_UNKNOWN", "WARN", "Token-2022 pause state was not verified.");
    score -= 8;
  }

  if (snapshot.defaultAccountState === "FROZEN") {
    add(findings, "DEFAULT_FROZEN", "CRITICAL", "New token accounts default to a frozen state.");
    score -= 25;
  }

  if (snapshot.metadataMutable === true) {
    add(findings, "MUTABLE_METADATA", "WARN", "Token metadata remains mutable.");
    score -= 5;
  } else if (snapshot.metadataMutable === null) {
    add(findings, "METADATA_UNKNOWN", "WARN", "Metadata mutability could not be verified.");
    score -= 3;
  }

  score = Math.max(0, Math.min(100, score));

  const hasCritical = findings.some((finding) => finding.severity === "CRITICAL");
  const decision = hasCritical || score < 60 ? "REJECT" : score < 80 ? "WARN" : "PASS";

  return { score, decision, findings };
}
