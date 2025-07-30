/**
 * Standard error response structure from API endpoints
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * HTTP error response structure with status information
 */
export interface HttpErrorResponse {
  response: {
    data: ErrorResponse;
    status: number;
    statusText: string;
  };
}

/**
 * Union type for different error formats that can be encountered
 */
export type AppError = Error | HttpErrorResponse | { message: string; error?: string; code?: string; type?: string } | null;

/**
 * Error info structure for user-friendly error handling
 */
export interface ErrorInfo {
  message: string;
  userAction?: string;
}
