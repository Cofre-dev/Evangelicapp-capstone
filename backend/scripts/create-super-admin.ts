import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateTemporaryPassword } from '../src/common/utils/generate-temporary-password';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../src/common/utils/username';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

interface Args {
  username?: string;
  email?: string;
  nombre?: string;
  apellido?: string;
  password?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const raw of argv) {
    const match = /^--([a-zA-Z]+)=(.*)$/.exec(raw);
    if (match) {
      (args as Record<string, string>)[match[1]] = match[2];
    }
  }
  return args;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8 && /(?=.*[a-zA-Z])(?=.*[0-9])/.test(password);
}

function printUsage() {
  console.error('Uso:');
  console.error(
    '  npm run create:superadmin -- --username=<usuario> --email=<correo> --nombre=<nombre> --apellido=<apellido> [--password=<contraseña>]',
  );
  console.error('');
  console.error('Si no pasas --password, se genera una temporal y se pide cambiarla en el primer login.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.username || !USERNAME_REGEX.test(args.username)) {
    console.error(`El --username es obligatorio. ${USERNAME_FORMAT_MESSAGE}.\n`);
    printUsage();
    process.exit(1);
  }

  if (!args.email || !isValidEmail(args.email)) {
    console.error('El --email es obligatorio y debe ser válido.\n');
    printUsage();
    process.exit(1);
  }

  if (!args.nombre || !args.apellido) {
    console.error('--nombre y --apellido son obligatorios.\n');
    printUsage();
    process.exit(1);
  }

  if (args.password && !isValidPassword(args.password)) {
    console.error('--password debe tener al menos 8 caracteres e incluir letra y número.');
    process.exit(1);
  }

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ username: args.username }, { email: args.email }] },
  });

  if (existente) {
    if (existente.rol === Rol.SUPER_ADMIN && existente.username === args.username) {
      console.log(`Ya existe un SUPER_ADMIN con ese usuario (${args.username}). No se hicieron cambios.`);
      process.exit(0);
    }
    console.error(
      `Ya existe un usuario con ese ${existente.username === args.username ? 'username' : 'correo'} (rol ${existente.rol}). Este script no sobrescribe cuentas existentes.`,
    );
    process.exit(1);
  }

  const passwordProvista = Boolean(args.password);
  const password = args.password ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.usuario.create({
    data: {
      username: args.username,
      email: args.email,
      password: passwordHash,
      nombre: args.nombre,
      apellido: args.apellido,
      rol: Rol.SUPER_ADMIN,
      iglesiaId: null,
      mustChangePassword: !passwordProvista,
      onboardingCompletado: true,
      activo: true,
    },
  });

  console.log(`SuperAdmin creado: ${args.username} (${args.email})`);
  if (!passwordProvista) {
    console.log(`Contraseña temporal (guárdala, no se volverá a mostrar): ${password}`);
    console.log('Deberá cambiarla en su primer inicio de sesión.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
