// Smoke test — confirms Vitest + TypeScript strict mode is wired correctly.
// This is NOT a meaningful test; it just proves the test runner works.

describe('scaffold', () => {
  it('runs vitest with TypeScript', () => {
    expect(1 + 1).toBe(2);
  });

  it('has access to jest-dom matchers via setup file', () => {
    const el = document.createElement('div');
    el.textContent = 'the board';
    expect(el).toHaveTextContent('the board');
  });
});
