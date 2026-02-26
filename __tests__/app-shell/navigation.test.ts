import { getAppShellNavigationModel, selectOperatorDisplay } from '@/lib/app-shell/navigation';

describe('getAppShellNavigationModel', () => {
  it('shows the admin link for admins and logout for all users', () => {
    expect(getAppShellNavigationModel('admin')).toEqual({
      links: [
        {
          href: '/admin/providers',
          id: 'admin',
          label: 'Admin',
        },
      ],
      showLogout: true,
    });
  });

  it('hides the admin link for non-admin users', () => {
    expect(getAppShellNavigationModel('user')).toEqual({
      links: [],
      showLogout: true,
    });
  });
});

describe('selectOperatorDisplay', () => {
  it('shows name + email when a name is present', () => {
    expect(selectOperatorDisplay('Ada Lovelace', 'ada@example.com')).toEqual({
      primary: 'Ada Lovelace',
      secondary: 'ada@example.com',
    });
  });

  it('falls back to email only when no name is present', () => {
    expect(selectOperatorDisplay(null, 'ada@example.com')).toEqual({
      primary: 'ada@example.com',
      secondary: null,
    });
  });
});
