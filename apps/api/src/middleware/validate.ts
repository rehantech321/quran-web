import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

function sendValidationError(res: Response, error: unknown) {
  res.status(400).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error },
  });
}

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, result.error.flatten());
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      sendValidationError(res, result.error.flatten());
      return;
    }
    req.params = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      sendValidationError(res, result.error.flatten());
      return;
    }
    // Express 4's req.query is a getter without a setter in the type defs, but is
    // assignable at runtime; parsed (coerced) values must replace the raw query so
    // downstream handlers see numbers/dates, not strings.
    Object.defineProperty(req, "query", { value: result.data, writable: true });
    next();
  };
}
