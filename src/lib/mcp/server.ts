import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KNOWN_DOMAINS, loadDomainContext } from '../context';
import {
  executeUpdateKnowledge,
  updateKnowledgeInputSchema,
  updateKnowledgeOutputSchema,
} from './tools/update-knowledge';

// ── Constants ────────────────────────────────────────────────────────────────

export const MCP_SERVER_NAME = 'the-board';
export const MCP_SERVER_VERSION = '0.1.0';

// ── Server Factory ───────────────────────────────────────────────────────────

/**
 * Create and configure the MCP server with all tools and resources.
 *
 * Tools registered:
 * - `update_domain_knowledge` — Append high-scoring debate insights to CONTEXT.md
 *
 * Resources registered:
 * - `context://{domain}` — Read domain CONTEXT.md files
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  registerTools(server);
  registerResources(server);

  return server;
}

// ── Tool Registration ────────────────────────────────────────────────────────

function registerTools(server: McpServer): void {
  // Single source of truth: reuse updateKnowledgeInputSchema.shape
  // so MCP protocol validation and application validation stay in sync.
  server.registerTool(
    'update_domain_knowledge',
    {
      title: 'Update Domain Knowledge',
      description:
        'Append a high-scoring debate insight to a domain CONTEXT.md file. ' +
        'Only executes when eval score >= 0.85. ' +
        'Phase 1: gated (logs intent). Phase 3: writes to file.',
      inputSchema: updateKnowledgeInputSchema.shape,
      annotations: {
        title: 'Update Domain Knowledge',
        // Phase 1: tool is gated (read-only). Phase 3: will perform writes.
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      // TODO(phase-3): Wrap with Langfuse span for tool observability
      const result = await executeUpdateKnowledge(args);

      // Validate output shape
      updateKnowledgeOutputSchema.parse(result);

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    },
  );
}

// ── Resource Registration ────────────────────────────────────────────────────

function registerResources(server: McpServer): void {
  for (const domain of KNOWN_DOMAINS) {
    server.registerResource(
      `${domain}-context`,
      `context://${domain}`,
      {
        description: `Interview prep knowledge for the ${domain} domain.`,
        mimeType: 'text/markdown',
      },
      async () => {
        const ctx = await loadDomainContext(domain);
        const text = ctx?.rawContent ?? `No context available for domain "${domain}".`;
        return {
          contents: [
            {
              uri: `context://${domain}`,
              text,
              mimeType: 'text/markdown',
            },
          ],
        };
      },
    );
  }
}
