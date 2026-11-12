import TurndownService from 'turndown';
import { requireApiUser } from '@/lib/auth';
import { getDocument } from '@/lib/documents';
import { toErrorResponse } from '@/lib/errors';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]/export'>) {
  try {
    const user = await requireApiUser();
    const doc = await getDocument(user, (await ctx.params).id);
    const md = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' }).turndown(doc.content);
    const filename = `${doc.title.replace(/[^\w\- ]+/g, '').trim() || 'document'}.md`;
    return new Response(`# ${doc.title}\n\n${md}\n`, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
