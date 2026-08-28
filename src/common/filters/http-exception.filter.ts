import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Request, Response } from 'express';

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const databaseUnavailable =
      exception instanceof PrismaClientKnownRequestError &&
      ['P1001', 'P1002'].includes(exception.code);
    const status = databaseUnavailable
      ? HttpStatus.SERVICE_UNAVAILABLE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (status >= 500) this.logger.error(exception);

    const message =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : databaseUnavailable
            ? 'The database is temporarily unavailable. Please try again shortly.'
            : status >= 500
              ? 'An unexpected error occurred.'
              : 'Request failed.';

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
