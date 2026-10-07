import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-faint">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-strong">Page not found</h1>
      <p className="max-w-sm text-sm text-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn btn-primary mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
