import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { heartbeat, leaveDocument } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';

type Ctx = RouteContext<'/api/documents/[id]/presence'>;

/** Heartbeat: "I have this document open". Returns the latest version and who else is here. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await heartbeat(user, (await ctx.params).id));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Sent when the tab closes so others stop seeing this user right away. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    await leaveDocument(user, (await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
