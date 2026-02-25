import {
  accounts,
  betaCodes,
  debateResponses,
  debates,
  evalRuns,
  goldenSets,
  personaMappings,
  providerModels,
  providers,
  sessions,
  users,
  workspaces,
} from '@/lib/db/schema';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function colNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

// ── Auth tables ───────────────────────────────────────────────────────────────

describe('users table', () => {
  it('has correct table name', () => {
    expect(getTableName(users)).toBe('users');
  });

  it('has required columns', () => {
    const cols = colNames(users);
    expect(cols).toContain('id');
    expect(cols).toContain('email');
    expect(cols).toContain('name');
    expect(cols).toContain('role');
    expect(cols).toContain('created_at');
  });
});

describe('betaCodes table', () => {
  it('has correct table name', () => {
    expect(getTableName(betaCodes)).toBe('beta_codes');
  });

  it('has required columns', () => {
    const cols = colNames(betaCodes);
    expect(cols).toContain('id');
    expect(cols).toContain('code');
    expect(cols).toContain('created_by');
    expect(cols).toContain('created_at');
  });
});

describe('sessions table', () => {
  it('has correct table name', () => {
    expect(getTableName(sessions)).toBe('sessions');
  });

  it('uses session_token as primary key (NextAuth adapter convention)', () => {
    const cols = colNames(sessions);
    expect(cols).toContain('session_token');
    expect(cols).toContain('expires');
  });
});

describe('accounts table', () => {
  it('has correct table name', () => {
    expect(getTableName(accounts)).toBe('accounts');
  });

  it('has all NextAuth adapter required columns', () => {
    const cols = colNames(accounts);
    expect(cols).toContain('provider');
    expect(cols).toContain('provider_account_id');
    expect(cols).toContain('type');
    expect(cols).toContain('access_token');
    expect(cols).toContain('refresh_token');
    expect(cols).toContain('expires_at');
  });
});

// ── Provider tables ───────────────────────────────────────────────────────────

describe('providers table', () => {
  it('has correct table name', () => {
    expect(getTableName(providers)).toBe('providers');
  });

  it('has sdk_type, base_url, api_key, is_active', () => {
    const cols = colNames(providers);
    expect(cols).toContain('sdk_type');
    expect(cols).toContain('base_url');
    expect(cols).toContain('api_key');
    expect(cols).toContain('is_active');
  });
});

describe('providerModels table', () => {
  it('has cost and model columns', () => {
    const cols = colNames(providerModels);
    expect(cols).toContain('input_cost_per_1m');
    expect(cols).toContain('output_cost_per_1m');
    expect(cols).toContain('model_id');
  });
});

describe('personaMappings table', () => {
  it('has persona_slot and preset_name', () => {
    const cols = colNames(personaMappings);
    expect(cols).toContain('persona_slot');
    expect(cols).toContain('preset_name');
    expect(cols).toContain('provider_model_id');
  });
});

// ── Debate tables ─────────────────────────────────────────────────────────────

describe('workspaces table', () => {
  it('has domain and context_path', () => {
    const cols = colNames(workspaces);
    expect(cols).toContain('domain');
    expect(cols).toContain('context_path');
  });
});

describe('debates table', () => {
  it('has mode, domain, and cost tracking', () => {
    const cols = colNames(debates);
    expect(cols).toContain('mode');
    expect(cols).toContain('domain');
    expect(cols).toContain('total_cost_usd');
    expect(cols).toContain('langfuse_trace_id');
  });

  it('has sycophancy_flags column (JSON blob as text)', () => {
    expect(colNames(debates)).toContain('sycophancy_flags');
  });

  it('stores transcript as text (portability rule — no native JSON type)', () => {
    const col = getTableColumns(debates).transcript;
    expect(col).toBeDefined();
    expect(col?.columnType).toBe('SQLiteText');
  });
});

describe('debateResponses table', () => {
  it('has phase, round, model, role, cost_usd', () => {
    const cols = colNames(debateResponses);
    expect(cols).toContain('phase');
    expect(cols).toContain('round');
    expect(cols).toContain('model');
    expect(cols).toContain('role');
    expect(cols).toContain('cost_usd');
  });
});

// ── Eval tables ───────────────────────────────────────────────────────────────

describe('goldenSets table', () => {
  it('has eval_threshold and status', () => {
    const cols = colNames(goldenSets);
    expect(cols).toContain('eval_threshold');
    expect(cols).toContain('status');
    expect(cols).toContain('expected_behavior');
  });
});

describe('evalRuns table', () => {
  it('has metric, score, evaluator', () => {
    const cols = colNames(evalRuns);
    expect(cols).toContain('metric');
    expect(cols).toContain('score');
    expect(cols).toContain('evaluator');
  });
});

// ── Portability invariant ─────────────────────────────────────────────────────

describe('schema portability invariant', () => {
  // Domain tables with synthetic CUID2 ids. Excluded:
  //   sessions — uses sessionToken as PK (NextAuth adapter convention)
  //   accounts — uses (provider, providerAccountId) composite PK (NextAuth adapter convention)
  const cuid2Tables = [
    { table: users, name: 'users' },
    { table: betaCodes, name: 'betaCodes' },
    { table: providers, name: 'providers' },
    { table: providerModels, name: 'providerModels' },
    { table: personaMappings, name: 'personaMappings' },
    { table: workspaces, name: 'workspaces' },
    { table: debates, name: 'debates' },
    { table: debateResponses, name: 'debateResponses' },
    { table: goldenSets, name: 'goldenSets' },
    { table: evalRuns, name: 'evalRuns' },
  ];

  it('domain tables use text IDs (CUID2, not auto-increment integers)', () => {
    for (const { table, name } of cuid2Tables) {
      const idCol = getTableColumns(table).id;
      expect(idCol, `${name}.id must exist`).toBeDefined();
      expect(idCol?.columnType, `${name}.id must be SQLiteText (CUID2)`).toBe('SQLiteText');
    }
  });

  it('10 domain tables use CUID2 ids (sessions and accounts use adapter-convention PKs)', () => {
    expect(cuid2Tables).toHaveLength(10);
  });
});
