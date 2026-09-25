import { generateCsrfToken } from './generate-csrf-token';

describe('generateCsrfToken', () => {
  it('genera un token hexadecimal de 64 caracteres (32 bytes)', () => {
    const token = generateCsrfToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('genera valores distintos entre llamadas', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(20);
  });
});
