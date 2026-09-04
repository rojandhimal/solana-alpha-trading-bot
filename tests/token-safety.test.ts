import { describe, expect, it } from "vitest";
import { assessTokenSafety } from "../packages/token-safety/src/index.js";
import type { TokenSafetySnapshot } from "../packages/token-safety/src/index.js";

const safe: TokenSafetySnapshot = {
  tokenAddress: "TestToken",
  tokenProgram: "SPL_TOKEN",
  mintAuthority: null,
  freezeAuthority: null,
  permanentDelegate: null,
  transferFeeBps: null,
  transferFeeMaxAmount: null,
  pausable: null,
  defaultAccountState: null,
  metadataMutable: false,
};

describe("token safety assessment", () => {
  it("passes a conservative SPL token with revoked authorities", () => {
    const result = assessTokenSafety(safe);
    expect(result.decision).toBe("PASS");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("rejects an active freeze authority", () => {
    const result = assessTokenSafety({ ...safe, freezeAuthority: "authority" });
    expect(result.decision).toBe("REJECT");
    expect(result.findings.map((f) => f.code)).toContain("FREEZE_AUTHORITY_ACTIVE");
  });

  it("rejects a permanent delegate", () => {
    const result = assessTokenSafety({ ...safe, tokenProgram: "TOKEN_2022", permanentDelegate: "delegate" });
    expect(result.decision).toBe("REJECT");
  });

  it("does not treat unknown Token-2022 pause state as safe", () => {
    const result = assessTokenSafety({ ...safe, tokenProgram: "TOKEN_2022", pausable: null });
    expect(result.findings.map((f) => f.code)).toContain("PAUSABLE_STATE_UNKNOWN");
  });
});
