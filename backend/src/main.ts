import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { setupSwagger } from './app.swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Préfixe global pour l'API
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  // Configuration de Swagger
  setupSwagger(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`
    🌳 Mokuen SwapForest API is running!
    📍 Server: http://localhost:${port}
    📚 Swagger: http://localhost:${port}/api
    🗄️  Database: NEON PostgreSQL
    🌍 Public forest data available to all users
  `);
}
bootstrap();