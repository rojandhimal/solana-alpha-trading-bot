import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /(?:SOLANA_PRIVATE_KEY|API_KEY|API_SECRET|ACCESS_TOKEN|PASSWORD)\s*=\s*["']?[1-9A-HJ-NP-Za-km-z]{32,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
];
const failures = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".env.example")) {
    failures.push(file);
    continue;
  }
  const content = readFileSync(file, "utf8");
  if (patterns.some((pattern) => pattern.test(content))) failures.push(file);
}
if (failures.length) {
  console.error(
    `Potential secret material in ${failures.length} tracked file(s); values withheld.`,
  );
  process.exitCode = 1;
} else
  console.log(
    `Secret-pattern check passed (${files.length} tracked files). Pattern scanning does not prove absence of every possible credential.`,
  );
