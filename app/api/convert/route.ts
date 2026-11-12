import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { fileToHtml } from '@/lib/import-file';

/**
 * Converts an uploaded .txt / .md / .docx file to sanitized editor HTML without creating a
 * document. Used by "Insert from file" to import content into an existing draft at the cursor;
 * the result is saved through the normal (permission-checked, versioned) save path.
 */
export async function POST(req: Request) {
  try {
    await requireApiUser();
    const form = await req.formData().catch(() => {
      throw new AppError(400, 'Expected a multipart form upload.');
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError(400, 'No file was uploaded.');
    const html = await fileToHtml(file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ html });
  } catch (e) {
    return toErrorResponse(e);
  }
}
