import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth';
import { getRevision, restoreRevision } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';

type Ctx = RouteContext<'/api/documents/[id]/revisions/[revisionId]'>;

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id, revisionId } = await ctx.params;
    return NextResponse.json(await getRevision(user, id, revisionId));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Restore this revision as the current content. Requires edit access and the caller's current version. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id, revisionId } = await ctx.params;
    const { baseVersion } = z.object({ baseVersion: z.number().int().positive() }).parse(await req.json());
    return NextResponse.json(await restoreRevision(user, id, revisionId, baseVersion));
  } catch (e) {
    return toErrorResponse(e);
  }
}
