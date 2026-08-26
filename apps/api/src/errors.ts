/** Domain errors raised by services — controllers (Phase 5/6) map these to HTTP status codes. */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity}_not_found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
