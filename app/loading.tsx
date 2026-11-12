// Suspense fallback for every route: pages here read per-user data (cookies + DB),
// so they stream in behind this shell instead of blocking navigation.
export default function Loading() {
  return (
    <div className="mx-auto mt-24 flex w-full max-w-3xl items-center justify-center p-6 text-sm text-gray-500" role="status">
      <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" aria-hidden />
      Loading…
    </div>
  );
}
