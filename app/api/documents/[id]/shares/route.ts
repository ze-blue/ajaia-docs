import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth';
import { listShares, revokeShare, shareDocument } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';
import { shareSchema } from '@/lib/validation';

type Ctx = RouteContext<'/api/documents/[id]/shares'>;

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ shares: await listShares(user, (await ctx.params).id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { email, role } = shareSchema.parse(await req.json());
    await shareDocument(user, (await ctx.params).id, email, role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await req.json());
    await revokeShare(user, (await ctx.params).id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
