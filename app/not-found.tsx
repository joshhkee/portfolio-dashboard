import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="panel flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-ink-300">404</p>
        <p className="text-2xl font-medium text-ink-100">Page not found</p>
        <p className="text-sm text-ink-300">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="btn-primary mt-2">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
