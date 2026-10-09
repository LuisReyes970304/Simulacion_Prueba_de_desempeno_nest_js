import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = new DocumentBuilder()
    .setTitle('Gestor de solicitudes')
    .setDescription('API de gestor de solicitudes RIWI')
    .setVersion('1.0')
    .addTag('APP')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  const port = process.env.PORT ?? 3010
  await app.listen(port);
  console.log(`API is running in http://localhost:${port}`);
  console.log(`Swagger test is running in http://localhost:${port}/docs`);
}
await bootstrap();
