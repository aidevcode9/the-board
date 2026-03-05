import type { BoardRuntimeState } from '@/lib/board/runtime';

type CompareModeViewProps = {
  runtime: BoardRuntimeState;
};

type CompareSlot = {
  borderClass: string;
  label: string;
  persona: 'claude' | 'gpt' | 'gemini';
  toneClass: string;
};

const COMPARE_SLOTS: CompareSlot[] = [
  {
    borderClass: 'border-persona-claude/60',
    label: 'Analyst',
    persona: 'claude',
    toneClass: 'text-persona-claude',
  },
  {
    borderClass: 'border-persona-gpt/60',
    label: 'Builder',
    persona: 'gpt',
    toneClass: 'text-persona-gpt',
  },
  {
    borderClass: 'border-persona-gemini/60',
    label: 'Synthesizer',
    persona: 'gemini',
    toneClass: 'text-persona-gemini',
  },
];

function findIndependentResponse(runtime: BoardRuntimeState, persona: CompareSlot['persona']) {
  for (const entry of runtime.timeline) {
    if (!entry || entry.kind !== 'participant') {
      continue;
    }
    if (entry.status !== 'complete') {
      continue;
    }
    if (entry.persona !== persona) {
      continue;
    }
    return entry;
  }
  return null;
}

export function CompareModeView({ runtime }: CompareModeViewProps) {
  return (
    <section className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Compare Results
      </p>
      <p className="mt-1 font-body text-sm text-text-muted">
        Independent responses only. No review or synthesis phases.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {COMPARE_SLOTS.map((slot) => {
          const response = findIndependentResponse(runtime, slot.persona);
          return (
            <article
              key={slot.persona}
              className={`rounded-xl border bg-board-card p-3 ${slot.borderClass}`}
            >
              <p className={`font-data text-[10px] tracking-widest uppercase ${slot.toneClass}`}>
                {slot.label}
              </p>
              {response ? (
                <>
                  {response.model || response.provider ? (
                    <p className="mt-1 font-data text-[10px] tracking-widest text-text-dim uppercase">
                      {[response.provider, response.model].filter(Boolean).join(' - ')}
                    </p>
                  ) : null}
                  {typeof response.confidence === 'number' ? (
                    <p className="mt-1 font-data text-[10px] tracking-widest text-text-dim uppercase">
                      {response.confidence}% confidence
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap font-body text-sm text-text-primary">
                    {response.content}
                  </p>
                </>
              ) : (
                <p className="mt-2 font-body text-sm text-text-muted">
                  Waiting for independent response...
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
