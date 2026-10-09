import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.resolveError(exception);

    const body: ErrorResponseBody = {
      success: false,
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return { statusCode: status, message: exceptionResponse, error: exception.name };
      }

      const responseObject = exceptionResponse as Record<string, unknown>;
      return {
        statusCode: status,
        message: (responseObject.message as string | string[]) ?? exception.message,
        error: (responseObject.error as string) ?? exception.name,
      };
    }

    if (exception instanceof QueryFailedError) {
      this.logger.error(exception.message, exception.stack);
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid database operation',
        error: 'Bad Request',
      };
    }

    const err = exception instanceof Error ? exception : new Error('Unknown error');
    this.logger.error(err.message, err.stack);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
