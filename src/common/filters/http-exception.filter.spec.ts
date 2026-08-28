import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { SafeHttpExceptionFilter } from './http-exception.filter';

describe('SafeHttpExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['P1001', 'P1002'])(
    'returns 503 for the Prisma database availability error %s',
    (code) => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({ url: '/api/auth/login' }),
        }),
      } as unknown as ArgumentsHost;
      const error = new PrismaClientKnownRequestError('Database unavailable', {
        code,
        clientVersion: 'test',
      });

      new SafeHttpExceptionFilter().catch(error, host);

      expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'The database is temporarily unavailable. Please try again shortly.',
          path: '/api/auth/login',
        }),
      );
    },
  );
});
