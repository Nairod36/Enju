import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { setupSwagger } from './app.swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ValidationPipe as CustomValidationPipe } from './common/pipes/validation.pipe';
import * as path from 'path';

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Optimisations pour VPS avec RAM limitée
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'debug', 'error', 'verbose', 'warn'],
    cors: true, // Activer CORS au niveau de l'app
  });

  // Configuration CORS complète
  app.enableCors({
    origin: (origin, callback) => {
      console.log(`🔥 CORS origin check: ${origin}`);
      // Accepter toutes les origines temporairement
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Préfixe global pour l'API
  app.setGlobalPrefix('api/v1');

  // Gestion globale des erreurs
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Validation globale des données
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Configuration de Swagger
  setupSwagger(app);

  const port = process.env.BACKEND_PORT || 3001;
  await app.listen(port);

  // Monitoring de base
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.rss / 1024 / 1024);
    if (memMB > 512) {
      console.warn(`⚠️  High memory usage: ${memMB}MB`);
    }
  }, 30000); // Check toutes les 30s

  console.log(`
    🌳 Enju SwapForest API is running!
    📍 Server: http://localhost:${port}
    📚 Swagger: http://localhost:${port}/api/v1/swagger
    🗄️  Database: NEON PostgreSQL
    🌍 Public forest data available to all users
    🐳 Docker: backend service running on port ${port}
    🛡️  Rate limiting: 100 req/min per IP
  `);
}
bootstrap();