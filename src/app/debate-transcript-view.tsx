import {
  type DebateDetailPayload,
  type TranscriptResponseRow,
  detectAgreementSignal,
  getEvalMetrics,
  getSycophancyFlagMessages,
  groupResponsesByPhase,
} from '@/lib/board/transcript';

type DebateTranscriptViewProps = {
  detail: DebateDetailPayload | null;
  errorMessage: string | null;
  isLoading: boolean;
};

const modelToneClass = {
  claude: 'text-persona-claude',
  gpt: 'text-persona-gpt',
  gemini: 'text-persona-gemini',
} as const;

const modelBorderClass = {
  claude: 'border-persona-claude/60',
  gpt: 'border-persona-gpt/60',
  gemini: 'border-persona-gemini/60',
} as const;

function phaseLabel(phase: string) {
  return `Phase ${phase}`;
}

function toModelKey(model: string): keyof typeof modelToneClass | null {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('gpt')) return 'gpt';
  if (normalized.includes('gemini')) return 'gemini';
  return null;
}

function signalBadgeClass(signal: 'agreement' | 'disagreement') {
  return signal === 'agreement'
    ? 'border-success/40 bg-success/10 text-success'
    : 'border-warning/40 bg-warning/10 text-warning';
}

function formatMetricLabel(metricKey: string) {
  return metricKey.replace(/[_-]+/g, ' ').trim();
}

function getFlagEntries(flags: string[]) {
  const counts = new Map<string, number>();
  return flags.map((flag) => {
    const count = (counts.get(flag) ?? 0) + 1;
    counts.set(flag, count);
    return { id: `${flag}-${count}`, text: flag };
  });
}

function responseRow(response: TranscriptResponseRow) {
  const signal = detectAgreementSignal(response.content);
  const modelKey = toModelKey(response.model);

  return (
    <article
      key={response.id}
      className={`rounded-xl border bg-board-card p-3 ${
        modelKey ? modelBorderClass[modelKey] : 'border-board-border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`font-data text-[10px] tracking-widest uppercase ${
            modelKey ? modelToneClass[modelKey] : 'text-text-muted'
          }`}
        >
          {response.model} - round {response.round}
        </p>
        {signal ? (
          <span
            className={`rounded-full border px-2 py-0.5 font-data text-[10px] tracking-widest uppercase ${signalBadgeClass(signal)}`}
          >
            {signal}
          </span>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap font-body text-sm text-text-primary">
        {response.content}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 font-data text-[10px] tracking-widest text-text-dim uppercase">
        {typeof response.confidence === 'number' ? (
          <span>{Math.round(response.confidence * 100)}% confidence</span>
        ) : null}
        {typeof response.costUsd === 'number' ? <span>${response.costUsd.toFixed(4)}</span> : null}
      </div>
    </article>
  );
}

export function DebateTranscriptView({
  detail,
  errorMessage,
  isLoading,
}: DebateTranscriptViewProps) {
  const evalMetrics = detail ? getEvalMetrics(detail.debate.evalDetails) : [];
  const sycophancyFlags = detail ? getSycophancyFlagMessages(detail.debate.sycophancyFlags) : [];
  const sycophancyFlagEntries = getFlagEntries(sycophancyFlags);

  return (
    <section className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Debate Transcript
      </p>

      {isLoading ? (
        <p className="mt-2 font-body text-sm text-text-muted">Loading transcript...</p>
      ) : null}

      {errorMessage ? (
        <div className="mt-2 rounded-xl border border-danger/40 bg-danger/10 p-3">
          <p className="font-data text-[10px] tracking-widest text-danger uppercase">
            Transcript error
          </p>
          <p className="mt-1 font-body text-sm text-text-primary">{errorMessage}</p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && !detail ? (
        <p className="mt-2 font-body text-sm text-text-muted">
          Transcript becomes available after debate completion.
        </p>
      ) : null}

      {!isLoading && !errorMessage && detail ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-data text-[10px] tracking-widest text-text-dim uppercase">
              Eval score:{' '}
              {typeof detail.debate.evalScore === 'number'
                ? detail.debate.evalScore.toFixed(2)
                : 'N/A'}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-data text-[10px] tracking-widest uppercase ${
                detail.debate.convergence
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-warning/40 bg-warning/10 text-warning'
              }`}
            >
              {detail.debate.convergence ? 'Converged' : 'Unresolved disagreement'}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-board-border bg-board-card p-3">
            <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
              Eval Metrics
            </p>
            {evalMetrics.length > 0 ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {evalMetrics.map((metric) => (
                  <article key={metric.key} className="rounded-lg border border-board-border p-2">
                    <p className="font-data text-[10px] tracking-widest text-text-dim uppercase">
                      {formatMetricLabel(metric.key)}
                    </p>
                    <p className="mt-1 font-body text-sm text-text-primary">
                      {typeof metric.score === 'number' ? metric.score.toFixed(2) : 'N/A'}
                    </p>
                    {metric.note ? (
                      <p className="mt-1 font-body text-xs text-text-muted">{metric.note}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-2 font-body text-sm text-text-muted">Eval metrics unavailable.</p>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-board-border bg-board-card p-3">
            <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
              Sycophancy Checks
            </p>
            {sycophancyFlags.length > 0 ? (
              <>
                <p className="mt-2 font-body text-sm text-warning">
                  {sycophancyFlags.length} flag{sycophancyFlags.length === 1 ? '' : 's'} detected.
                </p>
                <ul className="mt-2 grid gap-2">
                  {sycophancyFlagEntries.map((flag) => (
                    <li
                      key={flag.id}
                      className="rounded-lg border border-warning/40 bg-warning/10 p-2 font-body text-sm text-text-primary"
                    >
                      {flag.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 font-body text-sm text-success">No sycophancy flags detected.</p>
            )}
          </div>

          <div className="mt-3 grid gap-3">
            {groupResponsesByPhase(detail.responses).map((phaseGroup) => (
              <details
                key={phaseGroup.phase}
                className="rounded-xl border border-board-border bg-board-card p-3"
                open={phaseGroup.phase === 'independent'}
              >
                <summary className="cursor-pointer list-none font-data text-[10px] tracking-widest text-text-muted uppercase">
                  {phaseLabel(phaseGroup.phase)} - {phaseGroup.responses.length} entries
                </summary>
                <div className="mt-3 grid gap-3">
                  {phaseGroup.responses.map((response) => responseRow(response))}
                </div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
