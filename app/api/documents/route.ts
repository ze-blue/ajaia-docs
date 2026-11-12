import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createDocument } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';
import { createDocumentSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const { title } = createDocumentSchema.parse(await req.json().catch(() => ({})));
    const id = await createDocument(user, title);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
