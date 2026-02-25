#!/usr/bin/env node
import {
  formatLocalDate,
  formatLocalDateTime,
  getArg,
  getArgsList,
  parseArgs,
  readTextFile,
  writeTextFile,
} from './_common.mjs';

function buildList(label, values, fallback) {
  if (values.length === 0) {
    return [`**${label}:** ${fallback}`];
  }

  return [`**${label}:**`, ...values.map((value) => `- ${value}`)];
}

function insertBeforeNextSession(content, block) {
  const marker = '\n## Next Session';
  const markerIndex = content.indexOf(marker);

  if (markerIndex < 0) {
    return `${content.replace(/\n?$/, '\n')}\n${block}`;
  }

  const before = content.slice(0, markerIndex).replace(/\n+$/, '\n');
  const after = content.slice(markerIndex);
  return `${before}\n${block}${after}`;
}

function updateLastUpdated(content, dateText) {
  return content.replace(/^Last updated: .+$/m, `Last updated: ${dateText}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const checkpointFile = getArg(args, 'file', { defaultValue: 'CHECKPOINT.md' });
  const title = getArg(args, 'title', { required: true });
  const taskId = getArg(args, 'task-id', { required: true });
  const agent = getArg(args, 'agent', { required: true });
  const branch = getArg(args, 'branch', { required: true });
  const scope = getArg(args, 'scope', { required: true });
  const status = getArg(args, 'status', { defaultValue: 'Started' });
  const outcome = getArg(args, 'outcome', { defaultValue: 'in-progress' });
  const started = getArg(args, 'started', { defaultValue: formatLocalDateTime() });
  const ended = getArg(args, 'ended');
  const cycle = getArg(args, 'cycle');
  const requirement = getArg(args, 'fr', { defaultValue: 'N/A' });
  const review = getArg(args, 'review', { defaultValue: 'TBD' });
  const files = getArgsList(args, 'changed-file');
  const tests = getArgsList(args, 'test');
  const notes = getArgsList(args, 'note');
  const commits = getArgsList(args, 'commit');
  const outOfScope = getArg(args, 'out-of-scope', { defaultValue: 'TBD' });

  const headingTime = started;
  const lines = [
    `### ${headingTime} - ${title}`,
    '',
    `**Task ID:** ${taskId}`,
    `**Agent:** ${agent}`,
    `**Branch:** ${branch}`,
    `**Scope:** ${scope}`,
    `**Status:** ${status}`,
    `**Started:** ${started}`,
  ];

  if (ended) {
    lines.push(`**Ended:** ${ended}`);
  }
  if (cycle) {
    lines.push(`**Cycle Time:** ${cycle}`);
  }

  lines.push(`**FR / Requirement:** ${requirement}`);
  lines.push(...buildList('Files changed', files, 'TBD'));
  lines.push(`**Out of scope:** ${outOfScope}`);
  lines.push(...buildList('Tests (TDD/eval)', tests, 'TBD'));
  lines.push('**Verification (first pass?):**');
  lines.push('- [ ] lint');
  lines.push('- [ ] typecheck');
  lines.push('- [ ] test');
  lines.push('- [ ] build');
  lines.push('- [ ] evals (N/A)');
  lines.push('- First-pass all gates: TBD');
  lines.push(`**Review (gatekeeper):** ${review}`);
  lines.push('**Findings fixed:** Critical: 0, High: 0, Low: 0');
  lines.push(...buildList('Notes', notes, 'TBD'));
  lines.push(`**Outcome:** ${outcome}`);

  if (commits.length > 0) {
    lines.push(`**Commits:** ${commits.map((entry) => `\`${entry}\``).join(', ')}`);
  }

  lines.push('', '---', '');

  const block = lines.join('\n');
  const original = readTextFile(checkpointFile);
  const withBlock = insertBeforeNextSession(original, block);
  const updated = updateLastUpdated(withBlock, formatLocalDate());

  writeTextFile(checkpointFile, updated);
  process.stdout.write(`CHECKPOINT entry appended: ${title}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
