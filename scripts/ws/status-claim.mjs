#!/usr/bin/env node
import { formatLocalDateTime, getArg, parseArgs, readTextFile, writeTextFile } from './_common.mjs';
import {
  getSectionBodyLines,
  loadStatusDocument,
  normalizeStatusItemText,
  parseBulletSection,
  saveStatusDocument,
  setSectionBodyLines,
  updateLastUpdated,
  wrapSectionBody,
} from './_status-md.mjs';

const PLACEHOLDER_NEXT =
  '*(No queued items \u2014 refill `Next` before the next `wspr pick top Next` run)*';
const PLACEHOLDER_NEXT_ASCII =
  '*(No queued items - refill `Next` before the next `wspr pick top Next` run)*';

try {
  const args = parseArgs(process.argv.slice(2));
  const statusFile = getArg(args, 'file', { defaultValue: 'STATUS.md' });
  const agent = getArg(args, 'agent', { required: true });
  const branch = getArg(args, 'branch', { required: true });
  const task = getArg(args, 'task', { required: true });
  const started = getArg(args, 'started', { defaultValue: formatLocalDateTime() });
  const allowMissingNext = Boolean(args['allow-missing-next']);

  const lines = loadStatusDocument(readTextFile(statusFile));
  const nowBody = getSectionBodyLines(lines, 'Now');
  const nextBody = getSectionBodyLines(lines, 'Next');

  const nowParsed = parseBulletSection(nowBody);
  const nextParsed = parseBulletSection(nextBody);

  const nextItems = nextParsed.itemLines.filter((line) => normalizeStatusItemText(line) !== task);
  const taskFoundInNext = nextItems.length !== nextParsed.itemLines.length;

  if (!taskFoundInNext && !allowMissingNext) {
    throw new Error(`Task not found in STATUS.md Next: "${task}"`);
  }

  const claimLine = `- [${agent}] ${task} \u2014 branch: ${branch} \u2014 started: ${started}`;
  const duplicateClaim = nowParsed.itemLines.some(
    (line) => line.includes(`[${agent}]`) && line.includes(task),
  );
  if (duplicateClaim) {
    throw new Error(`Duplicate Now claim for "${task}" and agent "${agent}"`);
  }

  const cleanedNextPrefix = nextParsed.prefixLines.filter(
    (line) =>
      line.trim() !== '' &&
      line.trim() !== PLACEHOLDER_NEXT &&
      line.trim() !== PLACEHOLDER_NEXT_ASCII,
  );
  const rebuiltNextBodyLines =
    nextItems.length > 0 ? [...cleanedNextPrefix, ...nextItems] : [PLACEHOLDER_NEXT];

  const cleanedNowPrefix = nowParsed.prefixLines.filter(
    (line) => line.trim() !== '' && !line.startsWith('*('),
  );
  const rebuiltNowBodyLines = [...cleanedNowPrefix, ...nowParsed.itemLines, claimLine];

  setSectionBodyLines(lines, 'Now', wrapSectionBody(rebuiltNowBodyLines));
  setSectionBodyLines(lines, 'Next', wrapSectionBody(rebuiltNextBodyLines));
  updateLastUpdated(lines, started.slice(0, 10));

  writeTextFile(statusFile, saveStatusDocument(lines));

  const source = taskFoundInNext ? 'Next->Now' : 'override claim';
  process.stdout.write(`STATUS claim applied (${source}): ${claimLine}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
