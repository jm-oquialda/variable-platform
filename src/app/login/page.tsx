import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, input, notice } from "@/components/ui";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  send: "The sign-in link could not be sent. Try again in a minute.",
  link: "That sign-in link has expired or was already used. Request a new one.",
};

const choice =
  "flex cursor-pointer items-center gap-2 border border-line px-3 py-2.5 transition has-[:checked]:border-ink has-[:checked]:bg-accent-bg";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string; role?: string }>;
}) {
  const { sent, error, next, role } = await searchParams;
  const asTalent = role === "talent";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#ededed_0%,#ffffff_55%)] px-4 py-16">
      <Link href="/" className="mb-10 text-lg font-semibold tracking-tight">
        VAriable
      </Link>

      <div className="w-full max-w-sm border border-line bg-card p-8">
        {sent ? (
          <>
            <h1 className="text-2xl font-semibold">Check your email.</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-mid">
              VAriable sent you a sign-in link. Open it on this device to continue.
            </p>
            <Link href="/login" className="mt-6 inline-block border-b border-ink pb-0.5 text-sm font-medium">
              Use a different email
            </Link>
          </>
        ) : (
          <form action={sendMagicLink}>
            <h1 className="text-2xl font-semibold">{asTalent ? "Apply as talent." : "Sign in."}</h1>
            <p className="mt-2 text-sm text-ink-mid">No password needed. VAriable emails you a sign-in link.</p>

            {error && ERRORS[error] && (
              <p role="alert" className={`${notice} mt-5`}>
                {ERRORS[error]}
              </p>
            )}

            <label htmlFor="email" className="mt-6 block text-sm font-medium">
              Work email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className={`${input} mt-1.5`} />

            <fieldset className="mt-6">
              <legend className="text-sm font-medium">New here? I am</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <label className={choice}>
                  <input type="radio" name="role" value="client" defaultChecked={!asTalent} className="accent-black" />
                  Hiring talent
                </label>
                <label className={choice}>
                  <input type="radio" name="role" value="talent" defaultChecked={asTalent} className="accent-black" />
                  Applying as talent
                </label>
              </div>
              <p className="mt-2 text-xs text-ink-soft">Ignored if you already have an account.</p>
            </fieldset>

            <input type="hidden" name="next" value={next ?? ""} />

            <button type="submit" className={`${btnPrimary} mt-8 w-full`}>
              Email me a sign-in link <span aria-hidden>→</span>
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
