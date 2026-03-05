const personaToneClass = {
  claude: 'text-persona-claude',
  gpt: 'text-persona-gpt',
  gemini: 'text-persona-gemini',
} as const;

const personaBadgeLetter = {
  claude: 'A',
  gpt: 'B',
  gemini: 'S',
} as const;

const personaBorderClass = {
  claude: 'border-persona-claude',
  gpt: 'border-persona-gpt',
  gemini: 'border-persona-gemini',
} as const;

const personaGlowClass = {
  claude: 'bg-persona-claude-glow',
  gpt: 'bg-persona-gpt-glow',
  gemini: 'bg-persona-gemini-glow',
} as const;

type Persona = 'claude' | 'gpt' | 'gemini';

export function PersonaStatusCard({
  label,
  persona,
  status,
  value,
}: {
  label: string;
  persona: Persona;
  status: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-board-border bg-board-card p-3">
      <div className="flex items-start gap-3">
        <PersonaBadge persona={persona} />
        <div className="min-w-0 flex-1">
          <p className={`font-display text-base font-bold ${personaToneClass[persona]}`}>{label}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusLight status={status} />
            <p className="font-data text-[11px] tracking-widest text-text-muted uppercase">
              {status}
            </p>
          </div>
          <div className="mt-3">
            <GaugeMeter value={value} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaBadge({ persona }: { persona: Persona }) {
  return (
    <div
      aria-hidden="true"
      className={`grid h-10 w-10 place-items-center rounded-full border-2 ${personaBorderClass[persona]} ${personaGlowClass[persona]}`}
    >
      <span className="font-display text-base font-black text-text-primary">
        {personaBadgeLetter[persona]}
      </span>
    </div>
  );
}

function StatusLight({ status }: { status: string }) {
  const tone =
    status === 'complete'
      ? 'bg-success'
      : status === 'error'
        ? 'bg-danger'
        : status === 'thinking'
          ? 'bg-warning animate-pulse'
          : 'bg-text-dim';

  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${tone}`} />;
}

function GaugeMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="grid gap-1">
      <div className="h-2 rounded-full bg-gauge-track">
        <div className="h-full rounded-full bg-gauge-fill" style={{ width: `${clamped}%` }} />
      </div>
      <p className="font-data text-[10px] tracking-widest text-text-dim uppercase">
        {clamped}% confidence
      </p>
    </div>
  );
}
