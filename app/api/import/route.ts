import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createDocument } from '@/lib/documents';
import { AppError, toErrorResponse } from '@/lib/errors';
import { fileToHtml, titleFromFilename } from '@/lib/import-file';

/** Upload a .txt / .md / .docx file and turn it into a new editable document owned by the caller. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const form = await req.formData().catch(() => {
      throw new AppError(400, 'Expected a multipart form upload.');
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError(400, 'No file was uploaded.');

    const html = await fileToHtml(file.name, Buffer.from(await file.arrayBuffer()));
    const id = await createDocument(user, titleFromFilename(file.name), html);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
