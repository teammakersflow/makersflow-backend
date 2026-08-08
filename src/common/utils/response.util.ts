import { ApiResponse } from '../interfaces/api-response.interface';

export function successResponse<T>(
  message: string,
  data?: T,
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string): ApiResponse {
  return {
    success: false,
    message,
  };
}