import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

import * as express from 'express';
import cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Serve static files for MVP uploads
  const path = require('path');
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Task Bounty Platform API')
    .setDescription(`The Nền tảng Quản lý công việc và Giao việc tự do API description.

### Real-time Events (WebSocket)
This platform provides real-time updates via Socket.io.
- **Endpoint**: \`ws://<host>:<port>/notifications\`
- **Transports**: \`['websocket', 'polling']\`

#### Events to Listen For
1. **\`risk-alert\`**: Emitted when the AI detects a high risk score for a task.
   - Payload: \`{ pmId: string, message: string }\`
2. **\`balance-warning\`**: Emitted when the PM's escrow balance drops below a required threshold.
   - Payload: \`{ pmId: string, message: string }\`
`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Write Swagger JSON spec to file
  // Write Swagger JSON spec to file
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', 'swagger-spec.json'),
    JSON.stringify(document, null, 2),
  );

  // Use PORT from env
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs at: http://localhost:${port}/api-docs`);
}
bootstrap();
