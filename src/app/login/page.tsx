import type { Metadata } from "next";
import Link from "next/link";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  send: "The sign-in link could not be sent. Try again in a minute.",
  link: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const { sent, error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-lg font-semibold tracking-tight">
        VAriable
      </Link>

      {sent ? (
        <div className="rounded-lg border border-line bg-card p-6">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-ink-mid">
            VAriable sent you a sign-in link. Open it on this device to continue.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-accent underline">
            Use a different email
          </Link>
        </div>
      ) : (
        <form action={sendMagicLink} className="rounded-lg border border-line bg-card p-6">
          <h1 className="text-xl font-semibold">Sign in or create an account</h1>
          <p className="mt-2 text-sm text-ink-mid">No password needed. VAriable emails you a sign-in link.</p>

          {error && ERRORS[error] && (
            <p role="alert" className="mt-4 rounded-md bg-alert-bg px-3 py-2 text-sm text-alert">
              {ERRORS[error]}
            </p>
          )}

          <label htmlFor="email" className="mt-6 block text-sm font-medium">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
          />

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">New here? I am</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-accent">
                <input type="radio" name="role" value="client" defaultChecked />
                Hiring talent
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-accent">
                <input type="radio" name="role" value="talent" />
                Applying as talent
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-mid">Ignored if you already have an account.</p>
          </fieldset>

          <input type="hidden" name="next" value={next ?? ""} />

          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-accent px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Email me a sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
