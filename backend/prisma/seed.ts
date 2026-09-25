import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Fecha relativa a hoy, para que el semáforo de facturación se vea correcto sin importar cuándo se corra el seed. */
function diasDesdeHoy(dias: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

async function main() {
  const passwordHash = await bcrypt.hash('Temporal123', 10);

  // Plan PRO y facturación lejos de vencer (20 días): muestra el semáforo en verde.
  const iglesia = await prisma.iglesia.upsert({
    where: { id: 'igl_demo' },
    update: {},
    create: {
      id: 'igl_demo',
      nombre: 'Iglesia Evangélica Demo',
      comuna: 'Ñuñoa',
      region: 'Metropolitana',
      plan: 'PRO',
      proximaFacturacion: diasDesdeHoy(20),
    },
  });

  // update reasignado a los mismos valores que create: correr el seed de nuevo
  // resetea la cuenta demo a su estado de "primer login", útil tras probar el flujo.
  const datosDemo = {
    email: 'pastor@demo.cl',
    password: passwordHash,
    nombre: 'Juan',
    apellido: 'Pérez',
    rol: 'MANAGER' as const,
    iglesiaId: iglesia.id,
    mustChangePassword: true,
    onboardingCompletado: false,
    activo: true,
  };

  await prisma.usuario.upsert({
    where: { username: 'jperez' },
    update: datosDemo,
    create: { username: 'jperez', ...datosDemo },
  });

  // un par de iglesias adicionales, ya onboardeadas, para que el dashboard
  // de SuperAdmin tenga algo real que mostrar (varias regiones, > 1 pastor).
  // Planes y fechas de facturación variados a propósito: cubren los 3 planes y los
  // 3 colores del semáforo (ver calcularEstadoFacturacion) sin tocar código.
  const otrasIglesias = [
    {
      id: 'igl_valpo',
      nombre: 'Iglesia Luz y Vida',
      comuna: 'Valparaíso',
      region: 'Valparaíso',
      visitantesPromedio: 60,
      plan: 'MEDIO' as const,
      // Faltan 5 días: semáforo en amarillo.
      proximaFacturacion: diasDesdeHoy(5),
      pastor: { username: 'mrojas', email: 'pastor2@demo.cl', nombre: 'Marcela', apellido: 'Rojas' },
    },
    {
      id: 'igl_conce',
      nombre: 'Iglesia Nueva Esperanza',
      comuna: 'Concepción',
      region: 'Biobío',
      visitantesPromedio: 45,
      plan: 'BASICO' as const,
      // Vencida hace 2 días: semáforo en rojo, en mora pero todavía sin cumplir los
      // 3 días de gracia (ver DIAS_GRACIA_MORA) para poder ocultarla.
      proximaFacturacion: diasDesdeHoy(-2),
      pastor: { username: 'lfuentes', email: 'pastor3@demo.cl', nombre: 'Luis', apellido: 'Fuentes' },
    },
  ];

  for (const { pastor, ...datosIglesia } of otrasIglesias) {
    const otraIglesia = await prisma.iglesia.upsert({
      where: { id: datosIglesia.id },
      update: {},
      create: datosIglesia,
    });

    await prisma.usuario.upsert({
      where: { username: pastor.username },
      update: {},
      create: {
        username: pastor.username,
        email: pastor.email,
        password: passwordHash,
        nombre: pastor.nombre,
        apellido: pastor.apellido,
        rol: 'MANAGER',
        iglesiaId: otraIglesia.id,
        mustChangePassword: true,
        onboardingCompletado: true,
        activo: true,
      },
    });
  }

  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123', 10);

  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@evangelicapp.cl',
      password: superAdminPasswordHash,
      nombre: 'Admin',
      apellido: 'Plataforma',
      rol: 'SUPER_ADMIN',
      iglesiaId: null,
      mustChangePassword: false,
      onboardingCompletado: true,
      activo: true,
    },
  });

  console.log('Seed listo:');
  console.log('  Pastor:      usuario "jperez" / Temporal123');
  console.log('  SuperAdmin:  usuario "admin" / SuperAdmin123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
