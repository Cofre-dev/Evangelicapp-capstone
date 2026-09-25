import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { CsrfMiddleware } from './csrf.middleware';

function buildRequest(overrides: Partial<Request>): Request {
  return {
    method: 'POST',
    headers: {},
    cookies: {},
    ...overrides,
  } as Request;
}

describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();
  const res = {} as Response;

  it('deja pasar métodos no mutantes sin exigir nada', () => {
    const next = jest.fn();
    middleware.use(buildRequest({ method: 'GET' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('deja pasar una request mutante sin cookies de sesión (ej. login)', () => {
    const next = jest.fn();
    middleware.use(buildRequest({ method: 'POST', cookies: {} }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('exige el header X-CSRF-Token cuando hay cookie de sesión', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'POST',
      cookies: { access_token: 'jwt', csrf_token: 'abc123' },
      headers: {},
    });

    expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza si el header no coincide con la cookie csrf_token', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'PATCH',
      cookies: { access_token: 'jwt', csrf_token: 'abc123' },
      headers: { 'x-csrf-token': 'otro-valor' },
    });

    expect(() => middleware.use(req, res, next)).toThrow(ForbiddenException);
  });

  it('deja pasar si el header coincide con la cookie csrf_token', () => {
    const next = jest.fn();
    const req = buildRequest({
      method: 'DELETE',
      cookies: { refresh_token: 'jwt', csrf_token: 'abc123' },
      headers: { 'x-csrf-token': 'abc123' },
    });

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
