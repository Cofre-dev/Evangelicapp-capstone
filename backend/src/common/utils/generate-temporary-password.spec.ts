import { generateTemporaryPassword } from './generate-temporary-password';

describe('generateTemporaryPassword', () => {
  it('cumple la política mínima de /auth/change-password (8+ caracteres, letra y número)', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(10);
    expect(password).toMatch(/[A-Za-z]/);
    expect(password).toMatch(/[0-9]/);
  });

  it('no incluye caracteres ambiguos (0, O, 1, l, I)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTemporaryPassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it('genera valores distintos entre llamadas', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
