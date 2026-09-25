import { registerDecorator, ValidationOptions } from 'class-validator';
import { esRunValido } from '../utils/run';

export function IsRun(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRun',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && esRunValido(value);
        },
        defaultMessage(): string {
          return 'El RUN no es válido';
        },
      },
    });
  };
}
