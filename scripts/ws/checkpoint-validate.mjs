#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { ensure, getArg, parseArgs, readTextFile } from './_common.mjs';

const ENTRY_HEADING = /^### \d{4}-\d{2}-\d{2} \d{2}:\d{2} - .+$/gm;
const REQUIRED_ENTRY_FIELDS = [
  '**Task ID:**',
  '**Agent:**',
  '**Branch:**',
  '**Scope:**',
  '**Status:**',
  '**Started:**',
  '**FR / Requirement:**',
  '**Out of scope:**',
  '**Tests (TDD/eval):**',
  '**Verification (first pass?):**',
  '**Review (gatekeeper):**',
  '**Outcome:**',
];

function parseInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  ensure(Number.isFinite(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function lineCount(text) {
  return text.split('\n').length;
}

function sectionIndex(content, headingRegex, label) {
  const match = headingRegex.exec(content);
  ensure(match?.index !== undefined, `Missing section: ${label}`);
  return match.index;
}

function splitRollingEntries(content) {
  const rollingStart = sectionIndex(content, /^## Rolling Entries$/m, '## Rolling Entries');
  const templateStart = sectionIndex(content, /^## Entry Template/m, '## Entry Template');
  ensure(rollingStart < templateStart, 'Rolling entries section must be above entry template');

  const rollingBody = content.slice(rollingStart, templateStart);
  const starts = [...rollingBody.matchAll(ENTRY_HEADING)]
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);

  if (starts.length === 0) {
    return [];
  }

  const entries = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : rollingBody.length;
    const block = rollingBody.slice(start, end).trim();
    if (block.length > 0) {
      entries.push(block);
    }
  }

  return entries;
}

function validateEntry(entry) {
  const heading = entry.split('\n', 1)[0] ?? '(unknown heading)';
  const missing = REQUIRED_ENTRY_FIELDS.filter((field) => !entry.includes(field));
  ensure(missing.length === 0, `Entry missing required fields (${missing.join(', ')}): ${heading}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const checkpointFile = getArg(args, 'file', { defaultValue: 'CHECKPOINT.md' });
  const maxLines = parseInteger(getArg(args, 'max-lines', { defaultValue: '300' }), '--max-lines');

  ensure(existsSync(checkpointFile), `Missing file: ${checkpointFile}`);
  const content = readTextFile(checkpointFile);

  ensure(content.includes('## Archive Index'), 'Missing section: ## Archive Index');
  ensure(content.includes('docs/checkpoints/'), 'Archive index must reference docs/checkpoints/');

  const totalLines = lineCount(content);
  ensure(totalLines <= maxLines, `CHECKPOINT exceeds ${maxLines} lines (actual: ${totalLines})`);

  const entries = splitRollingEntries(content);
  for (const entry of entries) {
    validateEntry(entry);
  }

  process.stdout.write(
    `Checkpoint validation passed. lines=${totalLines}, entries=${entries.length}, max=${maxLines}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
