import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prisma } from '@prisma/client';

function transformDecimals(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Convert Prisma Decimal values to numbers
  if (Prisma.Decimal.isDecimal(value)) {
    return Number(value);
  }

  // Convert arrays recursively
  if (Array.isArray(value)) {
    return value.map(transformDecimals);
  }

  // Convert objects recursively
  if (typeof value === 'object') {
    const result: Record<string, any> = {};

    for (const [key, val] of Object.entries(value)) {
      result[key] = transformDecimals(val);
    }

    return result;
  }

  return value;
}

@Injectable()
export class ResponseInterceptor
  implements NestInterceptor
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Convert Prisma Decimal values before sending the response
        const transformedData = transformDecimals(data);

        // If response is already formatted, don't wrap it again
        if (
          transformedData &&
          typeof transformedData === 'object' &&
          'success' in transformedData &&
          'message' in transformedData
        ) {
          return transformedData;
        }

        return {
          success: true,
          message: 'Request completed successfully',
          data: transformedData,
        };
      }),
    );
  }
}