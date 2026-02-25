# DESIGN_SYSTEM.md — The Board

> Retro-Future Lab: Analog warmth meets digital precision. Vintage scientific instruments measuring AI output.

---

## Design Philosophy

The Board is a *laboratory instrument* — not a chatbot, not a SaaS dashboard. Every UI element should feel like it belongs on a beautifully designed piece of scientific equipment from a future that never quite happened. Warm materials (brass, amber glass, aged paper), precise typography (instrument labels, readout fonts), analog indicators (gauges, needle meters, status lights) — all rendering real-time AI telemetry.

**Three rules:**
1. **Warm, not cold.** Charcoal and cream, not pure black and white. Amber accents, not blue.
2. **Readable, not dense.** Debate content flows vertically as a timeline, not in cramped columns.
3. **Instrument, not decoration.** Every visual element (gauges, status lights, progress bars) displays real data.

---

## Layout Architecture

### The Three Zones (from UX review)

```
┌─────────────────────────────────────────────────────┐
│  HEADER (fixed)                                     │
│  Logo · Mode Selector · Cost Ticker · Theme Toggle  │
├─────────────────────────────────────────────────────┤
│  STATUS BOARD (sticky)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Analyst   │  │ Builder   │  │Synthesizer│         │
│  │ ◉ active  │  │ ◉ writing │  │ ○ waiting │         │
│  │ ▶ 87%     │  │ ▶ 92%     │  │ ▶ —       │         │
│  └──────────┘  └──────────┘  └──────────┘          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  DEBATE TIMELINE (scrollable, max-w-4xl, centered)  │
│                                                     │
│  ┌ Query ──────────────────────────────────────┐    │
│  │ "Design a rate limiter for a distributed..." │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌ The Builder (Drafting) ─────────────────────┐    │
│  │ green left border                            │    │
│  │ Here's a working sliding window impl...      │    │
│  │ ░░░░░░░░░ highlighted text ░░░░░░░░░         │    │
│  └─────────────────────────────────────────────┘    │
│       ╎                                             │
│       ╎ ── dashed connector                         │
│       ╎                                             │
│       ┌ The Analyst (Critique) ────────────────┐    │
│       │ purple border, indented                 │    │
│       │ "Response B's approach has a flaw..."   │    │
│       └────────────────────────────────────────┘    │
│                                                     │
│  ┌ The Synthesizer (Consensus) ────────────────┐    │
│  │ gradient top border (all three colors)       │    │
│  │ elevated shadow, larger text                 │    │
│  │ Final synthesized answer...                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
├─────────────────────────────────────────────────────┤
│  COMMAND BAR (fixed bottom)                         │
│  [ Steer the debate or ask a new query...   ] [Act] │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
- Status Board is **sticky** — always visible while scrolling the timeline
- Debate content is **vertical timeline**, not side-by-side columns (prevents Wall of Text problem)
- Critiques are **indented** with dashed connectors to the text they reference
- Synthesis card is **elevated** (larger shadow, gradient top border) to signal it's the final answer
- Command bar is **fixed bottom** with contextual action buttons that change by phase

### Contextual Command Bar Actions

| Debate Phase | Primary Action | Secondary Action |
|-------------|---------------|-----------------|
| Independent | — (models working) | Cancel |
| Cross-Review | Force Pivot | Skip to Synthesis |
| Synthesis | — (model working) | Request Revision |
| Validation | Approve | Disagree (triggers HITL) |
| Complete | New Query | Save to Golden Set |

---

## Color System

### CSS Custom Properties (Tailwind extend)

```css
/* Dark mode (default) */
:root {
  /* Base */
  --bg-primary: #1a1714;
  --bg-panel: #242018;
  --bg-card: #2e2820;
  --bg-card-hover: #3a332a;

  /* Borders */
  --border: #4a4035;
  --border-accent: #6b5d4d;

  /* Text */
  --text-primary: #e8e0d4;
  --text-muted: #9a8e7e;
  --text-dim: #6b5d4d;

  /* Accent (Amber/Gold — the signature color) */
  --accent: #d4a257;
  --accent-glow: rgba(212, 162, 87, 0.15);
  --accent-bright: #e8b96a;

  /* Persona Colors */
  --claude: #b48eda;
  --claude-glow: rgba(180, 142, 218, 0.12);
  --gpt: #6abf8a;
  --gpt-glow: rgba(106, 191, 138, 0.12);
  --gemini: #5a9fd4;
  --gemini-glow: rgba(90, 159, 212, 0.12);

  /* Status */
  --danger: #d45757;
  --success: #6abf8a;
  --warning: #d4a257;

  /* Instruments */
  --gauge-track: #3a332a;
  --gauge-fill: #d4a257;
  --needle: #e8e0d4;
}

/* Light mode */
[data-theme="light"] {
  --bg-primary: #f4efe8;
  --bg-panel: #ece5db;
  --bg-card: #ffffff;
  --bg-card-hover: #f9f6f1;
  --border: #d4cdc0;
  --border-accent: #b8a88e;
  --text-primary: #2e2820;
  --text-muted: #6b5d4d;
  --text-dim: #9a8e7e;
  --accent: #b8862e;
  --accent-glow: rgba(184, 134, 46, 0.1);
  --accent-bright: #d4a257;
  --claude: #8b5fc7;
  --claude-glow: rgba(139, 95, 199, 0.08);
  --gpt: #3a8f5a;
  --gpt-glow: rgba(58, 143, 90, 0.08);
  --gemini: #3a7fb8;
  --gemini-glow: rgba(58, 127, 184, 0.08);
  --danger: #c44040;
  --success: #3a8f5a;
  --warning: #b8862e;
  --gauge-track: #e8e0d4;
  --gauge-fill: #b8862e;
  --needle: #2e2820;
}
```

### Tailwind Config Extension

```typescript
// tailwind.config.ts
colors: {
  board: {
    bg: 'var(--bg-primary)',
    panel: 'var(--bg-panel)',
    card: 'var(--bg-card)',
    'card-hover': 'var(--bg-card-hover)',
    border: 'var(--border)',
    'border-accent': 'var(--border-accent)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    glow: 'var(--accent-glow)',
    bright: 'var(--accent-bright)',
  },
  persona: {
    claude: 'var(--claude)',
    'claude-glow': 'var(--claude-glow)',
    gpt: 'var(--gpt)',
    'gpt-glow': 'var(--gpt-glow)',
    gemini: 'var(--gemini)',
    'gemini-glow': 'var(--gemini-glow)',
  },
}
```

---

## Typography

### Font Stack (loaded via `next/font/google`)

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | Playfair Display | 700, 900 | Headers, persona names, logo, query text |
| Body | Source Serif 4 | 300, 400, 600 | Debate content, long-form text, synthesis |
| Data | Space Mono | 400, 700 | Labels, costs, model names, status, code |

### Type Scale

| Token | Size | Font | Usage |
|-------|------|------|-------|
| `text-display` | 24px | Playfair 900 | Page titles |
| `text-heading` | 20px | Playfair 700 | Query text, section headers |
| `text-subhead` | 16px | Playfair 700 | Persona names, card headers |
| `text-body` | 14px | Source Serif 400 | Debate content |
| `text-body-lg` | 16px | Source Serif 400 | Synthesis content (elevated) |
| `text-label` | 11px | Space Mono 400 | Status labels, costs, metadata |
| `text-micro` | 9-10px | Space Mono 400 | Uppercase tracking labels |
| `text-code` | 13px | Space Mono 400 | Inline code, technical terms |

### Rules
- **Never** use Inter, Roboto, Arial, or system sans-serif
- Display font (Playfair) is for **labels and headers only** — never body text
- Body font (Source Serif) handles all readable content
- Data font (Space Mono) handles all numbers, costs, status indicators
- All uppercase labels use `Space Mono` + `tracking-widest` + `text-[10px]`

---

## Signature Components

### 1. Analog Gauge Meter
Used for: Confidence scores, eval scores, model health.

SVG-based semicircular gauge with:
- Track in `--gauge-track`
- Fill in persona color (or `--gauge-fill` for generic)
- Needle pointing to value
- Drop shadow glow on the fill arc
- Numeric readout below in Space Mono

Appears in: Status Board persona cards, eval score display, model health dashboard.

### 2. Status Light
Used for: Model status (active/thinking/offline).

8px circle with:
- Green (`--success`) = active/complete
- Amber (`--warning`) = thinking (with `animate-pulse`)
- Red (`--danger`) = error/offline
- Gray = idle/waiting
- Box-shadow glow matching the color

### 3. Vintage Badge (Persona Avatar)
Used for: Persona identification in Status Board and Timeline.

40px circle with:
- 2px border in persona color
- Background in persona glow color
- Single letter in Playfair Display bold
- Used consistently in Status Board cards AND timeline entry headers

### 4. Toggle Switch
Used for: Mode selector, dark/light toggle, view switching.

Pill-shaped container with sliding indicator:
- Track in `--gauge-track`
- Active indicator in `--accent`
- Labels in Space Mono
- Rounded (border-radius: 20px)

### 5. Cost Ticker
Used for: Running debate cost, per-model cost.

Inline badge:
- Space Mono font
- Accent color text
- Accent glow background
- Subtle border
- Format: `$0.0847`

### 6. Critique Connector
Used for: Linking a critique to the text it references.

Visual thread showing which text a model is critiquing:
- Dashed border line from critique card to highlighted span
- Highlighted span gets persona-color background tint
- Critique card is indented (ml-12) from the original response
- Creates visual "thread" that makes debates legible

### 7. Synthesis Card (Elevated)
Used for: Final synthesized answer.

Distinguished from regular timeline entries:
- Gradient top border (all three persona colors)
- Larger shadow (`shadow-2xl`)
- Larger body text (`text-body-lg`)
- Full-width (not indented)

### 8. Phase Progress Indicator
Used for: Showing debate progress.

Horizontal bar of 4 segments:
- Filled segments in `--accent`
- Empty segments in `--gauge-track`
- Label: "Phase N of 4" in Space Mono micro

---

## Page Templates

### Debate View (Primary)
- Header + Status Board (sticky) + Debate Timeline + Command Bar (fixed)
- See Layout Architecture above

### Admin: Provider Config
- Header + Sidebar navigation + Provider list + Persona mapping
- Same warm palette, same fonts
- Provider rows with status lights, test buttons, latency/cost data
- Preset selector (Frontier/Budget/Free/Custom) as Toggle Switch

### Admin: User Management
- Header + Sidebar + User table
- Role badges (Admin = amber, User = neutral)
- Invite code generator with copy button

### Cost Dashboard
- Header + Grid of gauge meters (per-provider costs)
- Timeline chart of daily spend
- Mode breakdown (pie/donut in warm palette)

### Login / Beta Gate
- Centered card on warm background
- "the board" logo large
- Beta code input field (Space Mono, monospaced characters)
- Google sign-in button (standard OAuth button)
- Subtle vintage instrument decorations in background (low opacity)

---

## Animation Guidelines

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Timeline entry appearing | `fadeIn` + `slideUp` | 700ms | ease-out |
| Critique connector | `fadeIn` | 500ms | ease |
| Status light (thinking) | `pulse` | 1.5s | infinite |
| Typing cursor | `blink` | 1s | infinite |
| Theme toggle | Color transition | 400ms | ease |
| Gauge needle | Rotation to value | 800ms | ease-out |
| Phase progress fill | Width transition | 500ms | ease |

**Rules:**
- Animations are **functional** — they indicate state changes, not decoration
- No animation on scroll (no parallax, no scroll-triggered reveals)
- Reduced motion: respect `prefers-reduced-motion` — replace animations with instant transitions
- Page load: stagger timeline entries by 100ms each (max 5 items)

---

## Accessibility

- All interactive elements have visible focus rings (2px `--accent` outline)
- Color is never the sole indicator — status lights always have text labels
- Gauge meters have numeric readouts (not gauge-only)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Dark mode and light mode both pass WCAG AA
- All images/icons have `aria-label`
- Command bar input has proper `aria-label` and `role`
- Keyboard navigation: Tab through all interactive elements, Enter to activate

---

## Implementation Notes

### Next.js 15 Integration
- Fonts: `next/font/google` (Playfair Display, Source Serif 4, Space Mono)
- Colors: CSS custom properties set on `<html>` via `data-theme` attribute
- Tailwind: Extended with custom colors referencing CSS variables
- Dark mode: Toggle `data-theme` attribute, not Tailwind `dark:` prefix (CSS vars handle it)
- Server Components: All layout, header, status board can be Server Components. Only interactive elements (toggles, command bar, gauge animations) need `'use client'`

### Component Library
Use `shadcn/ui` as base, restyled with our design tokens:
- Override default colors/fonts with CSS variables
- Custom components for: GaugeMeter, StatusLight, CostTicker, PersonaBadge, ToggleSwitch
- Standard shadcn for: Dialog, Dropdown, Table, Input, Button (restyled)

### Markdown Rendering
Debate content rendered with `react-markdown` + custom remark plugins:
- Code blocks in Space Mono with warm dark background
- Inline code with `bg-black/20 px-1 rounded`
- Custom plugin for critique highlighting (wraps targeted spans in persona-colored background)
