import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = () => new AppError(404, 'Document not found or you do not have access to it.');
export const forbidden = (msg = 'You do not have permission to do that.') => new AppError(403, msg);

/** Converts any thrown value into a JSON error response for route handlers. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join('; ');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
