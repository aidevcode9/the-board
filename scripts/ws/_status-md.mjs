import { ensure } from './_common.mjs';

function splitLines(content) {
  return content.split('\n');
}

function joinLines(lines) {
  return lines.join('\n');
}

export function loadStatusDocument(content) {
  return splitLines(content);
}

export function saveStatusDocument(lines) {
  return joinLines(lines);
}

export function findSection(lines, heading) {
  const headingLine = `## ${heading}`;
  const headingIndex = lines.findIndex((line) => line.trim() === headingLine);
  ensure(headingIndex >= 0, `Could not find section "${headingLine}" in STATUS.md`);

  let nextHeadingIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      nextHeadingIndex = index;
      break;
    }
  }

  return {
    headingIndex,
    bodyStartIndex: headingIndex + 1,
    bodyEndIndex: nextHeadingIndex,
  };
}

export function getSectionBodyLines(lines, heading) {
  const section = findSection(lines, heading);
  return lines.slice(section.bodyStartIndex, section.bodyEndIndex);
}

export function setSectionBodyLines(lines, heading, bodyLines) {
  const section = findSection(lines, heading);
  lines.splice(section.bodyStartIndex, section.bodyEndIndex - section.bodyStartIndex, ...bodyLines);
}

export function updateLastUpdated(lines, dateText) {
  const index = lines.findIndex((line) => line.startsWith('Last updated: '));
  ensure(index >= 0, 'Could not find "Last updated:" line in STATUS.md');
  lines[index] = `Last updated: ${dateText}`;
}

export function normalizeStatusItemText(line) {
  let text = line.trim();
  text = text.replace(/^-+\s*/, '');
  text = text.replace(/^\[[ xX]\]\s*/, '');
  return text.trim();
}

export function parseBulletSection(bodyLines, itemRegex = /^-\s/) {
  const prefixLines = [];
  const itemLines = [];

  for (const line of bodyLines) {
    if (itemRegex.test(line)) {
      itemLines.push(line);
      continue;
    }

    if (itemLines.length === 0) {
      prefixLines.push(line);
      continue;
    }

    itemLines.push(line);
  }

  return { prefixLines, itemLines };
}

export function compactBody(lines) {
  const result = [...lines];
  while (result.length > 0 && result[0] === '') {
    result.shift();
  }
  while (result.length > 0 && result.at(-1) === '') {
    result.pop();
  }
  return result;
}

export function wrapSectionBody(lines) {
  const compact = compactBody(lines);
  return ['', ...compact, ''];
}
