import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    const value = hasValue ? next : true;

    if (hasValue) {
      index += 1;
    }

    const existing = args[key];
    if (existing === undefined) {
      args[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      continue;
    }

    args[key] = [existing, value];
  }

  return args;
}

export function getArg(args, key, options = {}) {
  const { required = false, defaultValue } = options;
  const value = args[key];

  if (value === undefined) {
    if (required) {
      throw new Error(`Missing required argument --${key}`);
    }
    return defaultValue;
  }

  if (Array.isArray(value)) {
    return value.at(-1);
  }

  return value;
}

export function getArgsList(args, key) {
  const value = args[key];
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value.map(String) : [String(value)];
}

export function readTextFile(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

export function writeTextFile(path, content) {
  const normalized = content.replace(/\r\n/g, '\n');
  writeFileSync(path, normalized.endsWith('\n') ? normalized : `${normalized}\n`, 'utf8');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatLocalDate(date = new Date()) {
  return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join('-');
}

export function formatLocalDateTime(date = new Date()) {
  return `${formatLocalDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function runGit(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).replace(/\r\n/g, '\n');
}
