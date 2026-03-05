# Checkpoint Archives

`CHECKPOINT.md` is a rolling log for active/recent work. Historical entries move here.

## Policy

- Keep root `CHECKPOINT.md` at or below 300 lines.
- Keep active entries and recent completions in `CHECKPOINT.md`.
- Archive older entries into monthly files: `docs/checkpoints/YYYY-MM.md`.
- Preserve entry text exactly when archiving (no rewrites).
- Keep one source of truth: `CHECKPOINT.md` + `docs/checkpoints/*`.

## Commands

- `npm run checkpoint:rollover`
  - Moves older rolling entries from `CHECKPOINT.md` into monthly archive files.
  - Updates `CHECKPOINT.md` archive index links when new archive files are created.
- `npm run checkpoint:validate`
  - Validates line count cap and required checkpoint entry structure.

## Baseline

- `docs/checkpoints/2026-legacy-pre-rollover.md` stores the pre-rollover full history snapshot.
