export enum ErrorCode {
  QUOTA_INSUFFICIENT = 'QUOTA_INSUFFICIENT',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public errorCode: ErrorCode,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}