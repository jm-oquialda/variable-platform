import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { btnSecondary, eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Request received" };

const NEXT = [
  "VAriable reviews your request and replies by email with any questions.",
  "You receive 5 to 10 hand-picked profiles, each with an intro video and a note on why they fit.",
  "You mark the ones you like and interview up to three.",
];

export default function ThanksPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <p className={eyebrow}>Request received</p>
        <h1 className="mt-3 text-4xl font-semibold">
          Thank you.
          <span className="block text-ink-soft">Matching starts now.</span>
        </h1>
        <ol className="mt-12 border-l border-t border-line text-left">
          {NEXT.map((step, i) => (
            <li key={step} className="flex gap-4 border-b border-r border-line p-5 text-sm">
              <span className="text-ink-soft">0{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Link href="/" className={`${btnSecondary} mt-10`}>
          Back to home <span aria-hidden>→</span>
        </Link>
      </main>
    </>
  );
}
