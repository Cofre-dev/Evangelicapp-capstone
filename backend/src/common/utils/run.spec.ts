import { esRunValido } from './run';

describe('esRunValido', () => {
  it('acepta un RUN válido (dígito verificador numérico correcto)', () => {
    // Cuerpo 11111111: suma ponderada (2,3,4,5,6,7,2,3) = 32 -> 32 % 11 = 10 -> resto 1 -> DV '1'.
    expect(esRunValido('11111111-1')).toBe(true);
  });

  it('rechaza un RUN con dígito verificador incorrecto', () => {
    expect(esRunValido('11111111-2')).toBe(false);
  });

  it('acepta "K" (mayúscula) como dígito verificador cuando corresponde', () => {
    // Cuerpo 11111112: suma ponderada (2,3,4,5,6,7,2,3) = 34 -> 34 % 11 = 1 -> resto 10 -> DV 'K'.
    expect(esRunValido('11111112-K')).toBe(true);
  });

  it('acepta "k" (minúscula) como dígito verificador cuando corresponde', () => {
    expect(esRunValido('11111112-k')).toBe(true);
  });

  it('rechaza formato sin guión', () => {
    expect(esRunValido('111111111')).toBe(false);
  });

  it('rechaza formato con letras en el cuerpo', () => {
    expect(esRunValido('1111111A-1')).toBe(false);
  });

  it('rechaza un cuerpo demasiado corto', () => {
    expect(esRunValido('123456-5')).toBe(false);
  });

  it('rechaza un cuerpo demasiado largo', () => {
    expect(esRunValido('123456789-1')).toBe(false);
  });
});
