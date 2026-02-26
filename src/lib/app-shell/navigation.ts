export type AppShellRole = 'admin' | 'user';

export type AppShellNavLink = {
  href: '/admin/providers';
  id: 'admin';
  label: 'Admin';
};

type AppShellNavigationModel = {
  links: AppShellNavLink[];
  showLogout: boolean;
};

type OperatorDisplay = {
  primary: string;
  secondary: string | null;
};

export function getAppShellNavigationModel(role: AppShellRole): AppShellNavigationModel {
  return {
    links: role === 'admin' ? [{ id: 'admin', label: 'Admin', href: '/admin/providers' }] : [],
    showLogout: true,
  };
}

export function selectOperatorDisplay(
  name: string | null | undefined,
  email: string,
): OperatorDisplay {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return { primary: trimmedName, secondary: email };
  }

  return { primary: email, secondary: null };
}
