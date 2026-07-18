import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const excluded = new Set(['scripts/security-scan.mjs']);
const fileNames = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
  .filter((fileName) => !excluded.has(fileName));

const forbiddenTerms = [
  ['DREI', 'BSB'].join('-'),
  ['UP', 'MV', 'INC'].join('-'),
  ['Amin', 'Contract'].join(''),
  ['c', 'odex'].join(''),
  ['chat', 'gpt'].join(''),
  ['open', 'ai'].join('')
];

const credentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
  /(?:sk_live|sk_test)_[A-Za-z0-9]{16,}/,
  /(?:private[_ -]?key)\s*[:=]\s*["']?(?:0x)?[0-9a-fA-F]{64}/i,
  /https:\/\/(?:eth-mainnet|eth-sepolia)\.g\.alchemy\.com\/v2\/[A-Za-z0-9_-]{12,}/i,
  /https:\/\/[A-Za-z0-9_-]{12,}\.infura\.io\/v3\/[A-Za-z0-9_-]{12,}/i
];

const findings = [];
for (const fileName of fileNames) {
  const content = fs.readFileSync(fileName);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');

  for (const term of forbiddenTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      findings.push(`${fileName}: forbidden private-origin or generator marker`);
    }
  }
  for (const pattern of credentialPatterns) {
    if (pattern.test(text)) {
      findings.push(`${fileName}: possible credential`);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`Security scan failed:\n${findings.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Privacy and credential scan passed for ${fileNames.length} files.\n`
  );
}
