// ── Context Module Shared Utilities ──────────────────────────────────────────

/** Check if an error is a filesystem ENOENT (file not found). */
export function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}
