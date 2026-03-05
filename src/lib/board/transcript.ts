export type TranscriptDebateRecord = {
  convergence: boolean | null;
  createdAt: string;
  domain: string;
  evalDetails: Record<string, unknown> | null;
  evalScore: number | null;
  id: string;
  mode: string;
  query: string;
  rounds: number | null;
  synthesizedAnswer: string | null;
  sycophancyFlags: unknown[] | null;
};

export type TranscriptResponseRow = {
  confidence: number | null;
  content: string;
  costUsd: number | null;
  createdAt: string;
  id: string;
  latencyMs: number | null;
  model: string;
  phase: string;
  role: string;
  round: number;
};

export type DebateDetailPayload = {
  debate: TranscriptDebateRecord;
  responses: TranscriptResponseRow[];
};

export type EvalMetric = {
  key: string;
  note: string | null;
  score: number | null;
};

const PHASE_ORDER = ['independent', 'review', 'synthesis', 'validation'] as const;

function phaseSortKey(phase: string): number {
  const index = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function groupResponsesByPhase(responses: TranscriptResponseRow[]) {
  const grouped = new Map<string, TranscriptResponseRow[]>();

  for (const response of responses) {
    const bucket = grouped.get(response.phase);
    if (bucket) {
      bucket.push(response);
    } else {
      grouped.set(response.phase, [response]);
    }
  }

  return Array.from(grouped.entries())
    .sort((left, right) => phaseSortKey(left[0]) - phaseSortKey(right[0]))
    .map(([phase, rows]) => ({
      phase,
      responses: [...rows].sort((left, right) => {
        if (left.round !== right.round) {
          return left.round - right.round;
        }
        return left.createdAt.localeCompare(right.createdAt);
      }),
    }));
}

export function detectAgreementSignal(content: string): 'agreement' | 'disagreement' | null {
  const normalized = content.toLowerCase();
  if (/\b(disagree|does not agree|don't agree|not agree|still disagree)\b/.test(normalized)) {
    return 'disagreement';
  }
  if (/\b(agree|agreement|consensus|validated|validation passed)\b/.test(normalized)) {
    return 'agreement';
  }
  return null;
}

function parseMetricValue(metricValue: unknown): EvalMetric | null {
  if (typeof metricValue === 'number') {
    return { key: '', note: null, score: metricValue };
  }
  if (!metricValue || typeof metricValue !== 'object' || Array.isArray(metricValue)) {
    return null;
  }

  const payload = metricValue as Record<string, unknown>;
  const score =
    typeof payload.score === 'number'
      ? payload.score
      : typeof payload.value === 'number'
        ? payload.value
        : null;
  const note =
    typeof payload.reason === 'string'
      ? payload.reason
      : typeof payload.reasoning === 'string'
        ? payload.reasoning
        : typeof payload.comment === 'string'
          ? payload.comment
          : null;

  if (score === null && note === null) {
    return null;
  }
  return { key: '', note, score };
}

export function getEvalMetrics(evalDetails: Record<string, unknown> | null): EvalMetric[] {
  if (!evalDetails) {
    return [];
  }

  return Object.entries(evalDetails).flatMap(([key, value]) => {
    const parsed = parseMetricValue(value);
    if (!parsed) {
      return [];
    }
    return [{ ...parsed, key }];
  });
}

function parseObjectFlag(flag: Record<string, unknown>): string {
  if (typeof flag.message === 'string') return flag.message;
  if (typeof flag.description === 'string') return flag.description;
  if (typeof flag.reason === 'string') return flag.reason;
  if (typeof flag.type === 'string') return flag.type;

  const fallback = JSON.stringify(flag);
  return fallback.length > 0 ? fallback : 'Sycophancy flag detected';
}

export function getSycophancyFlagMessages(flags: unknown[] | null): string[] {
  if (!Array.isArray(flags)) {
    return [];
  }

  return flags.flatMap((flag) => {
    if (typeof flag === 'string') {
      const trimmed = flag.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }

    if (flag && typeof flag === 'object' && !Array.isArray(flag)) {
      return [parseObjectFlag(flag as Record<string, unknown>)];
    }

    return [];
  });
}
