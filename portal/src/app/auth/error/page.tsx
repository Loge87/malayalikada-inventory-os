import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold">That link did not work</h1>
      <p className="mt-2 text-muted">It may have expired or already been used. Try signing in, or apply again.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/login" className="btn">Sign in</Link>
        <Link href="/signup" className="btn btn-primary">Apply for an account</Link>
      </div>
    </div>
  );
}
