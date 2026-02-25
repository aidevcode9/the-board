import { describe, expect, it, vi } from 'vitest';

// Mock server-only (no-op in test — imported transitively by context loader)
vi.mock('server-only', () => ({}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { KNOWN_DOMAINS } from '../../src/lib/context';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, createMcpServer } from '../../src/lib/mcp/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a connected MCP server + client pair for integration testing. */
async function createConnectedPair() {
  const mcpServer = createMcpServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);
  return { mcpServer, client };
}

// ── Server Creation ───────────────────────────────────────────────────────────

describe('createMcpServer', () => {
  it('creates an McpServer instance', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
    expect(server.isConnected()).toBe(false);
  });

  it('exposes the underlying Server via .server property', () => {
    const mcpServer = createMcpServer();
    expect(mcpServer.server).toBeDefined();
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('server constants', () => {
  it('MCP_SERVER_NAME is "the-board"', () => {
    expect(MCP_SERVER_NAME).toBe('the-board');
  });

  it('MCP_SERVER_VERSION matches package version format', () => {
    expect(MCP_SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ── Tool Registration (Integration) ──────────────────────────────────────────

describe('tool registration', () => {
  it('lists update_domain_knowledge tool', async () => {
    const { client } = await createConnectedPair();
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('update_domain_knowledge');
  });

  it('update_domain_knowledge tool has correct description', async () => {
    const { client } = await createConnectedPair();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'update_domain_knowledge');
    expect(tool?.description).toContain('high-scoring debate insight');
    expect(tool?.description).toContain('Phase 1');
  });

  it('calling tool with valid input returns gated result', async () => {
    const { client } = await createConnectedPair();
    const result = await client.callTool({
      name: 'update_domain_knowledge',
      arguments: {
        domain: 'system-design',
        section: 'coreConcepts',
        insight: 'CAP theorem insight.',
        debateId: 'clx_test123',
        evalScore: 0.92,
      },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const [first] = content;
    expect(first?.type).toBe('text');
    const parsed = JSON.parse(first?.text ?? '');
    expect(parsed.status).toBe('gated');
    expect(parsed.domain).toBe('system-design');
  });

  it('calling tool with below-threshold score returns below_threshold', async () => {
    const { client } = await createConnectedPair();
    const result = await client.callTool({
      name: 'update_domain_knowledge',
      arguments: {
        domain: 'security',
        section: 'misconceptions',
        insight: 'Low-score insight.',
        debateId: 'clx_low',
        evalScore: 0.5,
      },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const [first] = content;
    const parsed = JSON.parse(first?.text ?? '');
    expect(parsed.status).toBe('below_threshold');
  });
});

// ── Resource Registration (Integration) ──────────────────────────────────────

describe('resource registration', () => {
  it('lists resources for all known domains', async () => {
    const { client } = await createConnectedPair();
    const { resources } = await client.listResources();
    expect(resources.length).toBe(KNOWN_DOMAINS.length);
    for (const domain of KNOWN_DOMAINS) {
      const found = resources.find((r) => r.uri === `context://${domain}`);
      expect(found).toBeDefined();
    }
  });

  it('each resource has correct mime type', async () => {
    const { client } = await createConnectedPair();
    const { resources } = await client.listResources();
    for (const resource of resources) {
      expect(resource.mimeType).toBe('text/markdown');
    }
  });
});
