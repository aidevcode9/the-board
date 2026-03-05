import { PersonaStatusCard } from '@/app/status-board-primitives';
import type { BoardRuntimeState } from '@/lib/board/runtime';
import type { BoardMode } from '@/lib/modes/selection';
type BoardRuntimeViewProps = {
  activeMode: BoardMode;
  activeWorkspaceName: string | null;
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  queryInput: string;
  runtime: BoardRuntimeState;
  setQueryInput: (value: string) => void;
};
function modeLabel(mode: BoardMode) {
  switch (mode) {
    case 'quick':
      return 'Quick';
    case 'compare':
      return 'Compare';
    case 'debate':
      return 'Debate';
    case 'deep':
      return 'Deep Debate';
  }
}
const personaBorderClass = {
  claude: 'border-persona-claude/60',
  gpt: 'border-persona-gpt/60',
  gemini: 'border-persona-gemini/60',
} as const;
const personaToneClass = {
  claude: 'text-persona-claude',
  gpt: 'text-persona-gpt',
  gemini: 'text-persona-gemini',
} as const;
function confidenceMeter(confidence: number) {
  return (
    <div className="mt-2 grid gap-1">
      <div className="h-1.5 rounded-full bg-gauge-track">
        <div className="h-full rounded-full bg-gauge-fill" style={{ width: `${confidence}%` }} />
      </div>
      <p className="font-data text-[10px] tracking-widest text-text-dim uppercase">
        {confidence}% confidence
      </p>
    </div>
  );
}
function StatusBoard({ runtime }: { runtime: BoardRuntimeState }) {
  return (
    <div className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Status Board
      </p>
      <p className="mt-1 font-data text-[11px] text-accent-bright">
        Cost ticker: ${runtime.totalCostUsd.toFixed(4)}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <PersonaStatusCard
          label="Analyst"
          persona="claude"
          status={runtime.personas.claude.status}
          value={runtime.personas.claude.confidence}
        />
        <PersonaStatusCard
          label="Builder"
          persona="gpt"
          status={runtime.personas.gpt.status}
          value={runtime.personas.gpt.confidence}
        />
        <PersonaStatusCard
          label="Synthesizer"
          persona="gemini"
          status={runtime.personas.gemini.status}
          value={runtime.personas.gemini.confidence}
        />
      </div>
    </div>
  );
}
function TimelineView({
  activeWorkspaceName,
  runtime,
}: {
  activeWorkspaceName: string | null;
  runtime: BoardRuntimeState;
}) {
  return (
    <div className="rounded-2xl border border-board-border bg-board-panel p-4">
      <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">
        Debate Timeline
      </p>
      <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
        {activeWorkspaceName ? `Workspace: ${activeWorkspaceName}` : 'No Workspace Selected'}
      </h2>
      {runtime.status === 'human_review_required' ? (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="font-data text-[10px] tracking-widest text-warning uppercase">
            Human review required
          </p>
          <p className="mt-1 font-body text-sm text-text-primary">{runtime.humanReviewReason}</p>
        </div>
      ) : null}
      {runtime.status === 'error' && runtime.errorMessage ? (
        <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3">
          <p className="font-data text-[10px] tracking-widest text-danger uppercase">Run error</p>
          <p className="mt-1 font-body text-sm text-text-primary">{runtime.errorMessage}</p>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3">
        {runtime.timeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-board-border-accent bg-board-card p-4">
            <p className="font-body text-sm text-text-muted">
              Submit a prompt from the command bar to populate the timeline.
            </p>
          </div>
        ) : (
          runtime.timeline.map((entry) => (
            <article
              key={entry.id}
              className={`rounded-xl border bg-board-card p-4 shadow-[0_0_0_1px_rgba(212,162,87,0.04)] ${
                entry.kind === 'phase'
                  ? 'border-accent/30'
                  : entry.persona
                    ? personaBorderClass[entry.persona]
                    : 'border-board-border'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`font-data text-[10px] tracking-widest uppercase ${
                    entry.persona ? personaToneClass[entry.persona] : 'text-text-muted'
                  }`}
                >
                  {entry.title}
                </p>
                {entry.round ? (
                  <span className="rounded-full border border-board-border-accent bg-accent/10 px-2 py-0.5 font-data text-[10px] tracking-widest text-accent-bright uppercase">
                    Round {entry.round}
                  </span>
                ) : null}
              </div>
              {entry.status === 'thinking' ? (
                <p className="mt-2 font-data text-[10px] tracking-widest text-warning uppercase">
                  Typing...
                </p>
              ) : null}
              {entry.model || entry.provider ? (
                <p className="mt-2 font-data text-[10px] tracking-widest text-text-dim uppercase">
                  {[entry.provider, entry.model].filter(Boolean).join(' Â· ')}
                </p>
              ) : null}
              {typeof entry.confidence === 'number' ? confidenceMeter(entry.confidence) : null}
              {entry.content ? (
                <p className="mt-2 whitespace-pre-wrap font-body text-sm text-text-primary">
                  {entry.content}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
function CommandBar({
  activeMode,
  isBusy,
  onCancel,
  onSubmit,
  queryInput,
  setQueryInput,
}: {
  activeMode: BoardMode;
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  queryInput: string;
  setQueryInput: (value: string) => void;
}) {
  return (
    <footer className="sticky bottom-0 border-t border-board-border bg-board-bg/95 p-4 backdrop-blur">
      <form
        className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row"
        onSubmit={onSubmit}
      >
        <label className="sr-only" htmlFor="board-command-input">
          Command input
        </label>
        <input
          aria-label="Command input"
          className="h-11 w-full flex-1 rounded-xl border border-board-border bg-board-panel px-3 font-body text-sm text-text-primary placeholder:text-text-dim"
          id="board-command-input"
          onChange={(event) => setQueryInput(event.currentTarget.value)}
          placeholder={`Ask in ${modeLabel(activeMode)} mode...`}
          value={queryInput}
        />
        {isBusy ? (
          <button
            className="h-11 rounded-xl border border-board-border-accent bg-accent/10 px-4 font-data text-xs tracking-widest text-accent-bright uppercase"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : (
          <button
            className="h-11 rounded-xl border border-board-border-accent bg-accent/10 px-4 font-data text-xs tracking-widest text-accent-bright uppercase disabled:cursor-not-allowed"
            disabled={!queryInput.trim()}
            type="submit"
          >
            {`Run ${modeLabel(activeMode)}`}
          </button>
        )}
      </form>
    </footer>
  );
}
export function BoardRuntimeView({
  activeMode,
  activeWorkspaceName,
  isBusy,
  onCancel,
  onSubmit,
  queryInput,
  runtime,
  setQueryInput,
}: BoardRuntimeViewProps) {
  return (
    <>
      <StatusBoard runtime={runtime} />
      <TimelineView activeWorkspaceName={activeWorkspaceName} runtime={runtime} />
      <CommandBar
        activeMode={activeMode}
        isBusy={isBusy}
        onCancel={onCancel}
        onSubmit={onSubmit}
        queryInput={queryInput}
        setQueryInput={setQueryInput}
      />
    </>
  );
}
