export type TranscriptDebateRecord = {
  convergence: boolean | null;
  createdAt: string;
  domain: string;
  evalScore: number | null;
  id: string;
  mode: string;
  query: string;
  rounds: number | null;
  synthesizedAnswer: string | null;
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
