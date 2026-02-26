import { LogoutButton } from '@/app/logout-button';
import {
  type AppShellRole,
  getAppShellNavigationModel,
  selectOperatorDisplay,
} from '@/lib/app-shell/navigation';
import type { Route } from 'next';
import Link from 'next/link';

type AppShellNavProps = {
  operatorEmail: string;
  operatorName: string | null | undefined;
  operatorRole: AppShellRole;
};

export function AppShellNav({ operatorEmail, operatorName, operatorRole }: AppShellNavProps) {
  const navModel = getAppShellNavigationModel(operatorRole);
  const operator = selectOperatorDisplay(operatorName, operatorEmail);

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="rounded-xl border border-board-border bg-board-panel px-3 py-2 text-left sm:text-right">
        <p className="font-data text-[10px] tracking-widest text-text-muted uppercase">Operator</p>
        <p className="font-body text-sm text-text-primary">{operator.primary}</p>
        {operator.secondary ? (
          <p className="font-data text-[10px] tracking-widest text-text-dim">
            {operator.secondary}
          </p>
        ) : null}
      </div>

      <nav
        aria-label="Board shell navigation"
        className="flex flex-wrap items-center gap-2 sm:justify-end"
      >
        {navModel.links.map((link) => (
          <Link
            key={link.id}
            href={link.href as Route}
            className="inline-flex h-9 items-center rounded-lg border border-board-border bg-board-panel px-3 font-data text-[10px] tracking-widest text-text-primary uppercase transition-colors hover:border-board-border-accent hover:text-accent-bright focus-visible:outline-2 focus-visible:outline-accent"
          >
            {link.label}
          </Link>
        ))}
        {navModel.showLogout ? <LogoutButton /> : null}
      </nav>
    </div>
  );
}
