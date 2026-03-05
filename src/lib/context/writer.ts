// ── Context Writer ──────────────────────────────────────────────────────────
// Appends debate insights to domain CONTEXT.md files.
// SRP: loader.ts reads, writer.ts writes.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { KnownSection } from '../mcp/tools/update-knowledge';
import { isEnoent } from './errors';
import { DEFAULT_CONTEXT_DIR, DomainContextError, validateContextSize } from './loader';

/** Mapping from section keys to their ## heading text in CONTEXT.md. */
export const SECTION_HEADINGS: Record<KnownSection, string> = {
  coreConcepts: 'Core Concepts',
  disagreements: 'Key Disagreements & Resolutions',
  interviewFramings: 'Interview Framings',
  misconceptions: 'Common Misconceptions',
};

/** Placeholder patterns that indicate an empty section. */
const PLACEHOLDER_PATTERN = /^\*\(This section grows as .+\)\*$/;

export interface AppendInsightOptions {
  domain: string;
  section: KnownSection;
  insight: string;
  debateId: string;
  /** Override context directory (for testing). Defaults to DEFAULT_CONTEXT_DIR. */
  contextDir?: string;
}

export interface AppendInsightResult {
  status: 'updated' | 'budget_exceeded' | 'file_not_found';
  message: string;
}

/** Append an insight to a section of a domain's CONTEXT.md file. */
export async function appendInsightToSection(
  options: AppendInsightOptions,
): Promise<AppendInsightResult> {
  const { domain, section, insight, debateId } = options;
  const contextDir = options.contextDir ?? DEFAULT_CONTEXT_DIR;
  const basePath = resolve(process.cwd(), contextDir);
  const filePath = resolve(basePath, domain, 'CONTEXT.md');

  // Path traversal protection — filePath must stay inside contextDir
  if (!filePath.startsWith(basePath)) {
    throw new DomainContextError('PATH_TRAVERSAL', 'Context path escapes allowed directory');
  }

  // Read existing content
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (isEnoent(err)) {
      return { status: 'file_not_found', message: `CONTEXT.md not found for domain "${domain}".` };
    }
    throw err;
  }

  const heading = SECTION_HEADINGS[section];
  const bullet = `- ${insight} (source: ${debateId})`;

  // Append to section
  content = appendToSection(content, heading, bullet);

  // Update "Last update" date
  const today = new Date().toISOString().slice(0, 10);
  content = content.replace(/Last update: \d{4}-\d{2}-\d{2}/, `Last update: ${today}`);

  // Update References section with debate ID
  content = updateReferences(content, debateId);

  // Token budget check
  const sizeCheck = validateContextSize(content);
  if (!sizeCheck.isWithinBudget) {
    return {
      status: 'budget_exceeded',
      message: `Token budget exceeded: ${sizeCheck.estimatedTokens}/${sizeCheck.maxTokens} tokens.`,
    };
  }

  // Write updated content
  await writeFile(filePath, content, 'utf-8');

  return { status: 'updated', message: `Insight appended to ${heading}.` };
}

/** Append a bullet to the named ## section. Replaces placeholder text if present. */
function appendToSection(markdown: string, heading: string, bullet: string): string {
  const sectionStart = `## ${heading}`;
  const idx = markdown.indexOf(sectionStart);
  if (idx === -1) return markdown;

  // Find the end of this section (next ## or end of file)
  const afterHeading = idx + sectionStart.length;
  const nextSectionMatch = markdown.slice(afterHeading).search(/\n## /);
  const sectionEnd = nextSectionMatch === -1 ? markdown.length : afterHeading + nextSectionMatch;

  // Get section body (between heading and next section)
  let sectionBody = markdown.slice(afterHeading, sectionEnd);

  // Check for horizontal rule at end of section body
  const hrMatch = sectionBody.match(/\n---\s*$/);
  const trailingHr = hrMatch ? hrMatch[0] : '';
  if (trailingHr) {
    sectionBody = sectionBody.slice(0, -trailingHr.length);
  }

  // Check if section body is just a placeholder
  const bodyLines = sectionBody.trim().split('\n');
  const firstLine = bodyLines[0] ?? '';
  const isPlaceholder = bodyLines.length === 1 && PLACEHOLDER_PATTERN.test(firstLine);

  if (isPlaceholder) {
    // Replace placeholder with the bullet
    sectionBody = `\n\n${bullet}\n`;
  } else {
    // Append bullet after existing content
    sectionBody = `${sectionBody.trimEnd()}\n${bullet}\n`;
  }

  return markdown.slice(0, afterHeading) + sectionBody + trailingHr + markdown.slice(sectionEnd);
}

/** Add debateId to the References section. */
function updateReferences(markdown: string, debateId: string): string {
  // Replace "*(none yet)*" with actual ID
  if (markdown.includes('*(none yet)*')) {
    return markdown.replace('*(none yet)*', debateId);
  }
  // Append to existing list
  const refLine = '- Contributing debate IDs:';
  const refIdx = markdown.indexOf(refLine);
  if (refIdx === -1) return markdown;

  // Find end of the references line
  const lineEnd = markdown.indexOf('\n', refIdx);
  if (lineEnd === -1) {
    return `${markdown}, ${debateId}`;
  }
  const currentLine = markdown.slice(refIdx, lineEnd);
  if (currentLine.includes(debateId)) return markdown; // Already listed
  return `${markdown.slice(0, lineEnd)}, ${debateId}${markdown.slice(lineEnd)}`;
}
