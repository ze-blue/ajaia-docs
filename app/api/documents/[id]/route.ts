import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { deleteDocument, getDocument, updateDocument } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';
import { updateDocumentSchema } from '@/lib/validation';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]'>) {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getDocument(user, (await ctx.params).id));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/documents/[id]'>) {
  try {
    const user = await requireApiUser();
    const patch = updateDocumentSchema.parse(await req.json());
    return NextResponse.json(await updateDocument(user, (await ctx.params).id, patch));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/documents/[id]'>) {
  try {
    const user = await requireApiUser();
    await deleteDocument(user, (await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
