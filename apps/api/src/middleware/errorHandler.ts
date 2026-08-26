import type { NextFunction, Request, Response } from "express";

import { logger } from "../config/logger.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { InvalidCredentialsError } from "../services/auth.service.js";
import {
  InvalidPinError,
  InvalidStudentLinkError,
} from "../services/studentAccess.service.js";

interface ErrorBody {
  status: number;
  code: string;
  message: string;
}

/** Maps known domain errors to HTTP responses — never leaks a raw error string to the client. */
function mapError(err: unknown): ErrorBody {
  if (err instanceof NotFoundError) {
    return {
      status: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found",
    };
  }
  if (err instanceof ConflictError) {
    return { status: 409, code: "CONFLICT", message: err.message };
  }
  if (err instanceof ValidationError) {
    return { status: 400, code: "VALIDATION_ERROR", message: err.message };
  }
  if (err instanceof InvalidCredentialsError) {
    return {
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email/phone or password",
    };
  }
  if (err instanceof InvalidStudentLinkError) {
    return { status: 404, code: "NOT_FOUND", message: "Invalid or expired link" };
  }
  if (err instanceof InvalidPinError) {
    return { status: 401, code: "INVALID_PIN", message: "Incorrect PIN" };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong" };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const { status, code, message } = mapError(err);
  if (status >= 500) {
    logger.error({ err }, "Unhandled error");
  }
  res.status(status).json({ success: false, error: { code, message } });
}
