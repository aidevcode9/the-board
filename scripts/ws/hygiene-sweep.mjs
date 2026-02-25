#!/usr/bin/env node
import { getArg, getArgsList, parseArgs, runGit } from './_common.mjs';

function parsePorcelainLine(line) {
  const code = line.slice(0, 2);
  const payload = line.slice(3);
  const path = payload.includes(' -> ') ? payload.split(' -> ').at(-1) : payload;
  return { code, path };
}

function isAllowed(path, prefixes) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

try {
  const args = parseArgs(process.argv.slice(2));
  const cwd = getArg(args, 'cwd');
  const owner = getArg(args, 'owner', { defaultValue: 'Agent' });
  const noFail = Boolean(args['no-fail']);
  const allowPrefixes = getArgsList(args, 'allow-prefix');

  const output = runGit(['status', '--porcelain=v1', '--untracked-files=all'], cwd ? { cwd } : {});
  const lines = output.split('\n').filter(Boolean);

  if (lines.length === 0) {
    process.stdout.write('Hygiene sweep: worktree is clean.\n');
    process.exit(0);
  }

  const entries = lines.map(parsePorcelainLine);
  const allowed = [];
  const unexpected = [];

  for (const entry of entries) {
    if (allowPrefixes.length > 0 && isAllowed(entry.path, allowPrefixes)) {
      allowed.push(entry);
      continue;
    }
    unexpected.push(entry);
  }

  process.stdout.write(`Hygiene sweep (${owner})\n`);
  process.stdout.write(`- total changes: ${entries.length}\n`);
  process.stdout.write(`- allowed/expected: ${allowed.length}\n`);
  process.stdout.write(`- unexpected leftovers: ${unexpected.length}\n`);

  if (allowPrefixes.length > 0) {
    process.stdout.write(`- allow prefixes: ${allowPrefixes.join(', ')}\n`);
  }

  if (allowed.length > 0) {
    process.stdout.write('\nExpected/allowed:\n');
    for (const entry of allowed) {
      process.stdout.write(`  ${entry.code} ${entry.path}\n`);
    }
  }

  if (unexpected.length > 0) {
    process.stdout.write('\nUnexpected leftovers:\n');
    for (const entry of unexpected) {
      process.stdout.write(`  ${entry.code} ${entry.path}\n`);
    }
  }

  if (unexpected.length > 0 && !noFail) {
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
