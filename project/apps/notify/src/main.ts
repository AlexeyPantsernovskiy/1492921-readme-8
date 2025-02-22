import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const GLOBAL_PREFIX = 'api';
  app.setGlobalPrefix(GLOBAL_PREFIX);
  const port = process.env.PORT || 3336;
  await app.listen(port);
  Logger.log(
    `🚀 Service NOTIFY is running on: http://localhost:${port}/${GLOBAL_PREFIX}`
  );
}

bootstrap();
