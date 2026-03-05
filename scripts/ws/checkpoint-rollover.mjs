#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensure,
  formatLocalDate,
  getArg,
  parseArgs,
  readTextFile,
  writeTextFile,
} from './_common.mjs';

const ROLLING_HEADER = '## Rolling Entries';
const TEMPLATE_HEADER = '## Entry Template';
const ENTRY_HEADING = /^### (\d{4}-\d{2}-\d{2}) \d{2}:\d{2} - .+$/gm;

function parseInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  ensure(Number.isFinite(parsed) && parsed >= 0, `${label} must be a non-negative integer`);
  return parsed;
}

function lineCount(text) {
  return text.split('\n').length;
}

function getSectionIndexes(content) {
  const rollingMatch = /^## Rolling Entries$/m.exec(content);
  const templateMatch = /^## Entry Template/m.exec(content);
  ensure(rollingMatch?.index !== undefined, `Missing section: ${ROLLING_HEADER}`);
  ensure(templateMatch?.index !== undefined, `Missing section: ${TEMPLATE_HEADER}`);
  ensure(
    rollingMatch.index < templateMatch.index,
    `${ROLLING_HEADER} must be before ${TEMPLATE_HEADER}`,
  );

  return {
    rollingIndex: rollingMatch.index,
    rollingEnd: rollingMatch.index + rollingMatch[0].length,
    templateIndex: templateMatch.index,
  };
}

function splitRollingEntries(rollingSection) {
  const starts = [...rollingSection.matchAll(ENTRY_HEADING)]
    .map((match) => match.index ?? -1)
    .filter((value) => value >= 0);
  if (starts.length === 0) {
    return [];
  }

  const entries = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : rollingSection.length;
    const block = rollingSection.slice(start, end).trim();
    if (block.length > 0) {
      entries.push(block);
    }
  }
  return entries;
}

function parseEntryDate(entry) {
  const firstLine = entry.split('\n', 1)[0] ?? '';
  const match = /^### (\d{4}-\d{2}-\d{2}) \d{2}:\d{2} - .+$/.exec(firstLine);
  ensure(match !== null, `Invalid checkpoint entry heading: ${firstLine}`);
  return new Date(`${match[1]}T00:00:00`);
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildArchiveHeader(month) {
  return `# Checkpoint Archive ${month}\n\n> Archived entries moved from \`CHECKPOINT.md\` by checkpoint rollover.\n\n---\n`;
}

function appendArchiveEntries(archivePath, entries) {
  const existing = existsSync(archivePath)
    ? readTextFile(archivePath)
    : buildArchiveHeader(archivePath.slice(-10, -3));
  let updated = existing.replace(/\s*$/, '\n\n');

  for (const entry of entries) {
    const heading = entry.split('\n', 1)[0] ?? '';
    if (heading.length > 0 && existing.includes(heading)) {
      continue;
    }

    updated += `${entry}\n\n`;
    if (!entry.endsWith('\n---') && !entry.endsWith('\n---\n')) {
      updated += '---\n\n';
    }
  }

  writeTextFile(archivePath, updated);
}

function updateLastUpdated(content, dateText) {
  return content.replace(/^Last updated: .+$/m, `Last updated: ${dateText}`);
}

function updateArchiveIndex(content, monthFiles) {
  if (monthFiles.length === 0) {
    return content;
  }

  const archiveMatch = /^## Archive Index$/m.exec(content);
  if (archiveMatch?.index === undefined) {
    return content;
  }

  const start = archiveMatch.index + archiveMatch[0].length;
  const afterStart = content.slice(start);
  const nextSection = /\n## [^\n]+/.exec(afterStart);
  const end = nextSection ? start + nextSection.index : content.length;

  const sectionBody = content.slice(start, end);
  const existingLines = sectionBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());

  const merged = [
    ...new Set([
      ...existingLines,
      ...monthFiles.map((month) => `\`docs/checkpoints/${month}.md\``),
    ]),
  ];
  const rebuiltBody = `\n\n${merged.map((entry) => `- ${entry}`).join('\n')}\n\n`;

  return `${content.slice(0, start)}${rebuiltBody}${content.slice(end).replace(/^\n+/, '\n')}`;
}

function rebuildCheckpoint(prefix, entries, suffix) {
  if (entries.length === 0) {
    return `${prefix}\n\n${suffix.replace(/^\n+/, '\n')}`;
  }

  return `${prefix}\n\n${entries.join('\n\n')}\n\n${suffix.replace(/^\n+/, '\n')}`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const checkpointFile = getArg(args, 'file', { defaultValue: 'CHECKPOINT.md' });
  const archiveDir = getArg(args, 'archive-dir', { defaultValue: 'docs/checkpoints' });
  const keepDays = parseInteger(getArg(args, 'keep-days', { defaultValue: '14' }), '--keep-days');
  const maxLines = parseInteger(getArg(args, 'max-lines', { defaultValue: '300' }), '--max-lines');
  const dryRun = getArg(args, 'dry-run', { defaultValue: false }) === true;

  const content = readTextFile(checkpointFile);
  const { rollingEnd, templateIndex } = getSectionIndexes(content);
  const prefix = content.slice(0, rollingEnd);
  const rollingSection = content.slice(rollingEnd, templateIndex);
  const suffix = content.slice(templateIndex);

  const entries = splitRollingEntries(rollingSection);
  if (entries.length === 0) {
    process.stdout.write('No rolling checkpoint entries to archive.\n');
    process.exit(0);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  cutoff.setHours(0, 0, 0, 0);

  const keep = [];
  const archive = [];
  for (const entry of entries) {
    const entryDate = parseEntryDate(entry);
    if (entryDate < cutoff) {
      archive.push(entry);
    } else {
      keep.push(entry);
    }
  }

  let rebuilt = rebuildCheckpoint(prefix, keep, suffix);
  while (lineCount(rebuilt) > maxLines && keep.length > 1) {
    archive.push(keep.shift());
    rebuilt = rebuildCheckpoint(prefix, keep, suffix);
  }

  if (archive.length === 0) {
    process.stdout.write(`No entries archived. CHECKPOINT line count: ${lineCount(rebuilt)}\n`);
    process.exit(0);
  }

  const archiveByMonth = new Map();
  for (const entry of archive) {
    const month = monthKey(parseEntryDate(entry));
    const monthEntries = archiveByMonth.get(month) ?? [];
    monthEntries.push(entry);
    archiveByMonth.set(month, monthEntries);
  }

  if (!dryRun) {
    mkdirSync(archiveDir, { recursive: true });
    for (const [month, monthEntries] of archiveByMonth.entries()) {
      const archivePath = join(archiveDir, `${month}.md`);
      appendArchiveEntries(archivePath, monthEntries);
    }
  }

  let updatedCheckpoint = rebuildCheckpoint(prefix, keep, suffix);
  updatedCheckpoint = updateArchiveIndex(updatedCheckpoint, [...archiveByMonth.keys()]);
  updatedCheckpoint = updateLastUpdated(updatedCheckpoint, formatLocalDate());

  if (dryRun) {
    process.stdout.write(
      `Dry run: would archive ${archive.length} entries to ${[...archiveByMonth.keys()].join(', ')}. ` +
        `Resulting line count: ${lineCount(updatedCheckpoint)}\n`,
    );
    process.exit(0);
  }

  writeTextFile(checkpointFile, updatedCheckpoint);
  process.stdout.write(
    `Archived ${archive.length} entries to ${[...archiveByMonth.keys()].join(', ')}. ` +
      `CHECKPOINT line count: ${lineCount(updatedCheckpoint)}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
