"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const generate_temporary_password_1 = require("../src/common/utils/generate-temporary-password");
const prisma = new client_1.PrismaClient();
const BCRYPT_ROUNDS = 10;
function parseArgs(argv) {
    const args = {};
    for (const raw of argv) {
        const match = /^--([a-zA-Z]+)=(.*)$/.exec(raw);
        if (match) {
            args[match[1]] = match[2];
        }
    }
    return args;
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPassword(password) {
    return password.length >= 8 && /(?=.*[a-zA-Z])(?=.*[0-9])/.test(password);
}
function printUsage() {
    console.error('Uso:');
    console.error('  npm run create:superadmin -- --email=<correo> --nombre=<nombre> --apellido=<apellido> [--password=<contraseña>]');
    console.error('');
    console.error('Si no pasas --password, se genera una temporal y se pide cambiarla en el primer login.');
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
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
    const existente = await prisma.usuario.findUnique({ where: { email: args.email } });
    if (existente) {
        if (existente.rol === client_1.Rol.SUPER_ADMIN) {
            console.log(`Ya existe un SUPER_ADMIN con ese correo (${args.email}). No se hicieron cambios.`);
            process.exit(0);
        }
        console.error(`Ya existe un usuario con ese correo pero con rol ${existente.rol}. Este script no sobrescribe roles existentes.`);
        process.exit(1);
    }
    const passwordProvista = Boolean(args.password);
    const password = args.password ?? (0, generate_temporary_password_1.generateTemporaryPassword)();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.usuario.create({
        data: {
            email: args.email,
            password: passwordHash,
            nombre: args.nombre,
            apellido: args.apellido,
            rol: client_1.Rol.SUPER_ADMIN,
            iglesiaId: null,
            mustChangePassword: !passwordProvista,
            onboardingCompletado: true,
            activo: true,
        },
    });
    console.log(`SuperAdmin creado: ${args.email}`);
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
//# sourceMappingURL=create-super-admin.js.map