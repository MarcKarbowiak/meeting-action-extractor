export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal_error';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const toApiErrorPayload = (error: ApiError): { error: { code: string; message: string; details?: unknown } } => {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
};
