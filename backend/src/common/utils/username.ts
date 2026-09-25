/** minúsculas/números/punto/guión bajo, empieza con letra, 4-20 caracteres. */
export const USERNAME_REGEX = /^[a-z][a-z0-9._]{3,19}$/;

export const USERNAME_FORMAT_MESSAGE =
  'El usuario debe tener 4-20 caracteres, empezar con una letra y usar solo minúsculas, números, puntos o guiones bajos';
