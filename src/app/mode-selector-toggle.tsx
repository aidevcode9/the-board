import {
  BOARD_MODE_OPTIONS,
  type BoardMode,
  type ModeSelectionSource,
} from '@/lib/modes/selection';

type ModeSelectorToggleProps = {
  activeMode: BoardMode;
  activeWorkspaceId: string | null;
  selectionSource: ModeSelectionSource;
};

export function ModeSelectorToggle({
  activeMode,
  activeWorkspaceId,
  selectionSource,
}: ModeSelectorToggleProps) {
  return (
    <section className="min-w-0 rounded-xl border border-board-border bg-board-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">Mode</p>
          <p className="font-display text-base font-bold text-text-primary">Run Strategy</p>
        </div>
        {selectionSource === 'fallback' ? (
          <span className="font-data text-[10px] tracking-widest text-text-dim uppercase">
            default: debate
          </span>
        ) : null}
      </div>

      <form className="mt-3" method="get">
        {activeWorkspaceId ? (
          <input name="workspace" type="hidden" value={activeWorkspaceId} />
        ) : null}
        <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <legend className="sr-only">Mode selector</legend>
          {BOARD_MODE_OPTIONS.map((option) => {
            const isActive = option.id === activeMode;
            const isLive = option.availability === 'live';

            return (
              <button
                key={option.id}
                aria-pressed={isActive}
                className={[
                  'rounded-xl border px-3 py-2 text-left transition',
                  isActive
                    ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(212,162,87,0.16)]'
                    : 'border-board-border bg-board-card hover:border-board-border-accent',
                ].join(' ')}
                name="mode"
                type="submit"
                value={option.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data text-[11px] tracking-widest text-text-primary uppercase">
                    {option.label}
                  </span>
                  <span
                    className={[
                      'rounded-full border px-2 py-0.5 font-data text-[9px] tracking-widest uppercase',
                      isLive
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-board-border bg-board-panel text-text-dim',
                    ].join(' ')}
                  >
                    {isLive ? 'Live' : 'UI'}
                  </span>
                </div>
                <p className="mt-1 font-data text-[10px] text-text-muted">
                  {option.costMultiplier}
                </p>
              </button>
            );
          })}
        </fieldset>
      </form>
    </section>
  );
}
