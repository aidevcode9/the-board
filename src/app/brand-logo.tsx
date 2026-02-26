import { BRAND_ASSET_PATHS } from '@/lib/branding/metadata';

export function HeaderBrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-board-border bg-board-panel p-1">
        <img
          alt="the board logo"
          className="brand-logo-dark absolute inset-1 h-8 w-8 object-contain"
          height={1024}
          src={BRAND_ASSET_PATHS.headerLogoDark}
          width={1024}
        />
        <img
          alt="the board logo"
          className="brand-logo-light absolute inset-1 h-8 w-8 object-contain"
          height={1024}
          src={BRAND_ASSET_PATHS.headerLogoLight}
          width={1024}
        />
      </div>
      <div>
        <h1 className="font-display text-3xl font-black text-accent">the board</h1>
        <p className="font-data mt-1 text-[11px] tracking-widest text-text-muted uppercase">
          Adversarial Persona Synthesis Engine
        </p>
      </div>
    </div>
  );
}

export function LoginBrandLockup() {
  return (
    <div className="mb-10 text-center">
      <img
        alt="the board logo"
        className="mx-auto h-auto w-28 sm:w-32"
        height={307}
        src={BRAND_ASSET_PATHS.loginLogoVertical}
        width={277}
      />
      <h1 className="sr-only">the board</h1>
      <p className="font-data mt-3 text-[10px] uppercase tracking-widest text-text-muted">
        Adversarial Persona Synthesis Engine
      </p>
    </div>
  );
}
