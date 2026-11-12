import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { listRevisions } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]/revisions'>) {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ revisions: await listRevisions(user, (await ctx.params).id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
