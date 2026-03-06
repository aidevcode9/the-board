import 'server-only';

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { isEnoent } from './errors';

// ── Constants ────────────────────────────────────────────────────────────────

/** Known domain identifiers matching contexts/ directory structure. */
export const KNOWN_DOMAINS = [
  'system-design',
  'ai-ethics',
  'code-generation',
  'security',
  'distributed-systems',
  'ml-engineering',
] as const;

export type KnownDomain = (typeof KNOWN_DOMAINS)[number];

/** Default directory for domain CONTEXT.md files, relative to project root. */
export const DEFAULT_CONTEXT_DIR = 'contexts';

/** Default token budget per domain context file. */
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Conservative characters-per-token estimate for markdown content.
 * Markdown with formatting (###, **, -) averages ~3 chars/token.
 * Using 3 provides a safety margin over the typical 4 for prose.
 */
const CHARS_PER_TOKEN = 3;

// ── Types ────────────────────────────────────────────────────────────────────

export interface DomainContext {
  domain: string;
  overview: string;
  coreConcepts: string;
  disagreements: string;
  interviewFramings: string;
  misconceptions: string;
  rawContent: string;
}

export interface ContextSizeResult {
  isWithinBudget: boolean;
  estimatedTokens: number;
  maxTokens: number;
}

// ── Error ────────────────────────────────────────────────────────────────────

export class DomainContextError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainContextError';
  }
}

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load domain context from a CONTEXT.md file.
 *
 * @param domain - Domain identifier (e.g. 'system-design')
 * @param contextPath - Optional custom path override (relative to project root)
 * @returns Parsed domain context or null if file doesn't exist
 */
export async function loadDomainContext(
  domain: string,
  contextPath?: string | null,
): Promise<DomainContext | null> {
  const filePath = contextPath
    ? resolveContextPath(contextPath)
    : resolveContextPath(join(DEFAULT_CONTEXT_DIR, domain, 'CONTEXT.md'));

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw new DomainContextError('LOAD_FAILED', `Failed to load context for domain "${domain}"`);
  }

  return parseDomainContext(content, domain);
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse raw CONTEXT.md markdown into structured sections.
 * Extracts content between known ## headings.
 */
export function parseDomainContext(markdown: string, domain: string): DomainContext {
  return {
    domain,
    overview: extractSection(markdown, 'Overview'),
    coreConcepts: extractSection(markdown, 'Core Concepts'),
    disagreements: extractSection(markdown, 'Key Disagreements & Resolutions'),
    interviewFramings: extractSection(markdown, 'Interview Framings'),
    misconceptions: extractSection(markdown, 'Common Misconceptions'),
    rawContent: markdown,
  };
}

// ── Token Estimation ─────────────────────────────────────────────────────────

/** Rough token count estimate using ~3 characters per token for markdown content. */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Validate that context content is within the token budget. */
export function validateContextSize(
  markdown: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): ContextSizeResult {
  const estimatedTokens = estimateTokenCount(markdown);
  return {
    isWithinBudget: estimatedTokens <= maxTokens,
    estimatedTokens,
    maxTokens,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve and validate a context file path against the allowed base directory.
 * Prevents path traversal attacks (e.g., '../../etc/passwd').
 */
function resolveContextPath(relativePath: string): string {
  const basePath = resolve(process.cwd(), DEFAULT_CONTEXT_DIR);
  const resolved = resolve(process.cwd(), relativePath);

  if (!resolved.startsWith(basePath)) {
    throw new DomainContextError('PATH_TRAVERSAL', 'Context path escapes allowed directory');
  }
  return resolved;
}

/**
 * Extract the content of a ## section from markdown.
 * Splits on ## headings and finds the matching one.
 */
function extractSection(markdown: string, heading: string): string {
  // Split into sections at each ## heading boundary
  const sections = markdown.split(/\n(?=## )/);
  const prefix = `## ${heading}`;
  const target = sections.find(
    (s) => s === prefix || s.startsWith(`${prefix}\n`) || s.startsWith(`${prefix}\r`),
  );
  if (!target) return '';

  // Remove the heading line
  const bodyStart = target.indexOf('\n');
  if (bodyStart === -1) return '';
  let body = target.slice(bodyStart + 1);

  // Strip trailing horizontal rules (--- between sections)
  body = body.replace(/\n---\s*$/, '');

  const trimmed = body.trim();
  if (trimmed === '---') return '';
  return trimmed;
}

// Re-export isEnoent from shared errors module
export { isEnoent } from './errors';
