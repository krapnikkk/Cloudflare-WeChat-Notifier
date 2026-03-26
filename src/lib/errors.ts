export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type IlinkErrorCategory = "unauthorized" | "context" | "retryable" | "unknown";

export class IlinkApiError extends Error {
  public readonly category: IlinkErrorCategory;
  public readonly httpStatus?: number;
  public readonly ret?: number;
  public readonly errcode?: number;
  public readonly upstreamUrl?: string;

  public constructor(
    message: string,
    options: {
      category: IlinkErrorCategory;
      httpStatus?: number;
      ret?: number;
      errcode?: number;
      upstreamUrl?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = "IlinkApiError";
    this.category = options.category;
    this.httpStatus = options.httpStatus;
    this.ret = options.ret;
    this.errcode = options.errcode;
    this.upstreamUrl = options.upstreamUrl;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
export const isIlinkApiError = (error: unknown): error is IlinkApiError => error instanceof IlinkApiError;

const toPlainError = (error: unknown): unknown => {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    cause: error.cause ? toPlainError(error.cause) : undefined
  };
};

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
};

export const toErrorDetails = (error: unknown): Record<string, unknown> | null => {
  if (isIlinkApiError(error)) {
    return {
      category: error.category,
      httpStatus: error.httpStatus ?? null,
      ret: error.ret ?? null,
      errcode: error.errcode ?? null,
      upstreamUrl: error.upstreamUrl ?? null,
      cause: error.cause ? toPlainError(error.cause) : null
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause ? toPlainError(error.cause) : null
    };
  }

  return null;
};
