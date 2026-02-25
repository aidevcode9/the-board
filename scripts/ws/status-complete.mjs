#!/usr/bin/env node
import { formatLocalDate, getArg, parseArgs, readTextFile, writeTextFile } from './_common.mjs';
import {
  getSectionBodyLines,
  loadStatusDocument,
  parseBulletSection,
  saveStatusDocument,
  setSectionBodyLines,
  updateLastUpdated,
  wrapSectionBody,
} from './_status-md.mjs';

function buildDoneLine({ task, owner, date, ref, cycle }) {
  let line = `- [x] ${task} \u2014 owner: ${owner} \u2014 ${date}`;
  if (ref) {
    line += ` \u2014 ${ref}`;
  }
  if (cycle) {
    line += ` \u2014 cycle: ${cycle}`;
  }
  return line;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const statusFile = getArg(args, 'file', { defaultValue: 'STATUS.md' });
  const agent = getArg(args, 'agent', { required: true });
  const task = getArg(args, 'task', { required: true });
  const owner = getArg(args, 'owner', { defaultValue: agent });
  const date = getArg(args, 'date', { defaultValue: formatLocalDate() });
  const ref = getArg(args, 'ref');
  const cycle = getArg(args, 'cycle');
  const keepNow = Boolean(args['keep-now']);

  const lines = loadStatusDocument(readTextFile(statusFile));
  const nowBody = getSectionBodyLines(lines, 'Now');
  const doneBody = getSectionBodyLines(lines, 'Done (This Week)');

  const nowParsed = parseBulletSection(nowBody);
  const doneParsed = parseBulletSection(doneBody, /^- \[x\]\s/i);

  const filteredNowItems = nowParsed.itemLines.filter((line) => {
    if (!line.includes(`[${agent}] ${task}`)) {
      return true;
    }
    return !line.includes(' branch: ');
  });
  const claimRemoved = filteredNowItems.length !== nowParsed.itemLines.length;

  if (!claimRemoved && !keepNow) {
    throw new Error(`Could not find matching Now claim for "${task}" and agent "${agent}"`);
  }

  const doneLine = buildDoneLine({ task, owner, date, ref, cycle });
  const duplicateDone = doneParsed.itemLines.some(
    (line) => line.includes(`- [x] ${task}`) && line.includes(`owner: ${owner}`),
  );
  if (duplicateDone) {
    throw new Error(`Done entry already exists for "${task}" and owner "${owner}"`);
  }

  const rebuiltNowBodyLines = [...nowParsed.prefixLines, ...filteredNowItems];
  const rebuiltDoneBodyLines = [...doneParsed.prefixLines, ...doneParsed.itemLines, doneLine];

  setSectionBodyLines(lines, 'Now', wrapSectionBody(rebuiltNowBodyLines));
  setSectionBodyLines(lines, 'Done (This Week)', wrapSectionBody(rebuiltDoneBodyLines));
  updateLastUpdated(lines, date);

  writeTextFile(statusFile, saveStatusDocument(lines));
  process.stdout.write(`STATUS completion applied: ${doneLine}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
