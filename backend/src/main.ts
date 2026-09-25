import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './common/utils/cors-origins.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render (y cualquier PaaS con reverse proxy) entrega todo el tráfico desde una
  // única IP interna — sin esto, req.ip siempre sería esa IP del proxy y el rate
  // limiting (ThrottlerGuard, ver app.module.ts) terminaría compartiendo el mismo
  // balde entre TODOS los clientes reales en vez de uno por IP real. El valor `1`
  // confía en un solo hop de proxy (el de Render), no en cualquier X-Forwarded-For
  // que mande el cliente.
  app.set('trust proxy', 1);

  // Necesario para que req.cookies exista (lo leen JwtAuthGuard, AuthController#refresh y CsrfMiddleware).
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Las cookies exigen credentials:true en el fetch del frontend, lo que a su vez
  // prohíbe origin:"*" en CORS.
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
