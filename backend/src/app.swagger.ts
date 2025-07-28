// src/swagger.ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
    const config = new DocumentBuilder()
        .setTitle('API Web3 Realtime')
        .addTag('users', 'User management and wallet authentication')
        .addTag('biomes', 'Forest biome management and tree growth')
        .addTag('public', 'Public data accessible to everyone')
        .setDescription('Docs de l’API (NestJS + Web3 + Real-Time)')
        .addBearerAuth({
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'JWT',
            description: 'Enter JWT token',
            in: 'header',
        }, 'JWT-auth')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        ignoreGlobalPrefix: false,
    });

    SwaggerModule.setup('api/v1/swagger', app, document, {
        customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #2d5a27; }
    `,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
        },
    });
}
