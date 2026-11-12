import Link from 'next/link';
import { DocumentEditor } from '@/components/DocumentEditor';
import { requirePageUser } from '@/lib/auth';
import { type Doc, getDocument } from '@/lib/documents';
import { AppError } from '@/lib/errors';

export default async function DocPage({ params }: PageProps<'/docs/[id]'>) {
  const { id } = await params;
  const user = await requirePageUser();

  let doc: Doc | null = null;
  try {
    doc = await getDocument(user, id);
  } catch (e) {
    if (!(e instanceof AppError && e.status === 404)) throw e;
  }

  if (!doc) {
    return (
      <main className="mx-auto mt-24 max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Document unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">
          It doesn&apos;t exist, or {user.name} doesn&apos;t have access. Ask the owner to share it with {user.email}.
        </p>
        <Link href="/" className="mt-4 inline-block text-blue-700 hover:underline">
          Back to documents
        </Link>
      </main>
    );
  }

  return <DocumentEditor key={doc.id} doc={doc} userName={user.name} />;
}
