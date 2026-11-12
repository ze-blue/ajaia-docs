import { z } from 'zod';

export const MAX_CONTENT_CHARS = 1_000_000; // ~1 MB of HTML

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title cannot be empty.')
  .max(200, 'Title must be 200 characters or fewer.');

export const updateDocumentSchema = z
  .object({
    title: titleSchema.optional(),
    content: z.string().max(MAX_CONTENT_CHARS, 'Document is too large to save.').optional(),
    /** The version the client last loaded. A mismatch means someone else saved in between. */
    baseVersion: z.number().int().positive(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, 'Nothing to update.');

export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: z.enum(['viewer', 'editor']),
});

const emailSchema = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.');

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Name must be 80 characters or fewer.'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(200, 'Password must be 200 characters or fewer.'),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const createDocumentSchema = z.object({
  title: titleSchema.optional(),
});
