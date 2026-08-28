import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SafeHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config
    .getOrThrow<string>('FRONTEND_URL')
    .replace(/\/$/, '');
  const production = config.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  app.use((request: Request, _response: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const origin = request.get('origin');
    if (
      (origin && origin.replace(/\/$/, '') !== frontendUrl) ||
      (production && !origin)
    ) {
      return next(new ForbiddenException('Request origin is not allowed.'));
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new SafeHttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT', 4000));
}
void bootstrap();
