"use client";

import { useActionState } from "react";
import { askQuestion, type QuestionFormState } from "@/app/actions";
import { btnPrimary, input, notice } from "@/components/ui";
import { HONEYPOT_FIELD } from "@/lib/requests";

export function QuestionForm() {
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(askQuestion, {});
  const e = state.errors ?? {};

  if (state.sent) {
    return (
      <div role="status" className="border border-line bg-card p-6">
        <p className="font-semibold">Thanks. Your question is in.</p>
        <p className="mt-1 text-sm text-ink-mid">VAriable replies by email.</p>
      </div>
    );
  }

  return (
    <form key={state.attempt ?? 0} action={action} noValidate className="space-y-4 border border-line bg-card p-6">
      {state.formError && (
        <p role="alert" className={notice}>
          {state.formError}
        </p>
      )}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Name
          <input name="name" autoComplete="name" defaultValue={state.values?.name} className={`${input} mt-1.5`} aria-invalid={!!e.name} />
          {e.name && <span className="mt-1 block text-xs">{e.name}</span>}
        </label>
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} className={`${input} mt-1.5`} aria-invalid={!!e.email} />
          {e.email && <span className="mt-1 block text-xs">{e.email}</span>}
        </label>
      </div>
      <label className="block text-sm font-medium">
        Question
        <textarea name="message" rows={4} defaultValue={state.values?.message} className={`${input} mt-1.5`} aria-invalid={!!e.message} />
        {e.message && <span className="mt-1 block text-xs">{e.message}</span>}
      </label>
      <button type="submit" disabled={pending} className={`${btnPrimary} disabled:opacity-50`}>
        {pending ? "Sending" : "Ask VAriable"} <span aria-hidden>→</span>
      </button>
    </form>
  );
}
