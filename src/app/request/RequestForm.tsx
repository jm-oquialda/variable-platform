"use client";

import { useActionState } from "react";
import { btnPrimary, input, notice } from "@/components/ui";
import { NICHES } from "@/lib/niches";
import { COMMITMENTS, HONEYPOT_FIELD, SCHEDULES, TIME_ZONES } from "@/lib/requests";
import { submitTalentRequest, type RequestFormState } from "./actions";

export type TierOption = { slug: string; name: string; fromPrice: string | null };

const choice =
  "flex cursor-pointer items-start gap-3 border border-line bg-card p-4 text-sm transition has-[:checked]:border-ink has-[:checked]:bg-accent-bg";

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-mid">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

function Group({ legend, error, children }: { legend: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-xs font-medium">{error}</p>}
    </fieldset>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 md:grid-cols-[200px_1fr]">
      <div>
        <span className="text-xs text-ink-soft">{n}</span>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function RequestForm({
  tiers,
  defaults,
}: {
  tiers: TierOption[];
  defaults: { contact_name?: string; contact_email?: string };
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(submitTalentRequest, {});
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const e = state.errors ?? {};
  const aria = (name: string, error?: string) =>
    error ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};

  return (
    <form key={state.attempt ?? 0} action={action} noValidate>
      {(state.formError || Object.keys(e).length > 0) && (
        <p role="alert" className={`${notice} mb-6`}>
          {state.formError ?? "Check the highlighted answers below."}
        </p>
      )}

      {/* Honeypot: hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Fax number
          <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Section n="01" title="The role">
        <Field label="Role" htmlFor="niche" error={e.niche}>
          <select id="niche" name="niche" defaultValue={v("niche")} className={input} {...aria("niche", e.niche)}>
            <option value="" disabled>
              Choose a role
            </option>
            <optgroup label="Core roles">
              {NICHES.filter((n) => n.group === "core").map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="More roles">
              {NICHES.filter((n) => n.group === "more").map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field
          label="Main tasks"
          hint="What would you hand off first? A few sentences is enough."
          htmlFor="tasks"
          error={e.tasks}
        >
          <textarea
            id="tasks"
            name="tasks"
            rows={4}
            defaultValue={v("tasks")}
            className={input}
            {...aria("tasks", e.tasks)}
          />
        </Field>
        <Field label="Tools you use" hint="Optional. For example Google Workspace, Slack, HubSpot." htmlFor="tools" error={e.tools}>
          <input id="tools" name="tools" defaultValue={v("tools")} className={input} />
        </Field>
      </Section>

      <Section n="02" title="Hours and start">
        <Group legend="Hours" error={e.schedule}>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCHEDULES.map((s) => (
              <label key={s.value} className={choice}>
                <input type="radio" name="schedule" value={s.value} defaultChecked={v("schedule") === s.value} className="mt-0.5 accent-black" />
                <span>
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-ink-mid">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Group>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Your time zone" htmlFor="time_zone" error={e.time_zone}>
            <select id="time_zone" name="time_zone" defaultValue={v("time_zone")} className={input} {...aria("time_zone", e.time_zone)}>
              <option value="" disabled>
                Choose a time zone
              </option>
              {TIME_ZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ideal start date" hint="Optional." htmlFor="start_date" error={e.start_date}>
            <input id="start_date" name="start_date" type="date" defaultValue={v("start_date")} className={input} {...aria("start_date", e.start_date)} />
          </Field>
        </div>
      </Section>

      <Section n="03" title="Plan">
        <Group legend="Tier" error={e.tier_slug}>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiers.map((t) => (
              <label key={t.slug} className={choice}>
                <input type="radio" name="tier" value={t.slug} defaultChecked={v("tier") === t.slug} className="mt-0.5 accent-black" />
                <span>
                  <span className="font-medium">{t.name}</span>
                  {t.fromPrice && <span className="block text-xs text-ink-mid">From {t.fromPrice}/mo</span>}
                </span>
              </label>
            ))}
            <label className={choice}>
              <input type="radio" name="tier" value="unsure" defaultChecked={v("tier", "unsure") === "unsure"} className="mt-0.5 accent-black" />
              <span>
                <span className="font-medium">Not sure</span>
                <span className="block text-xs text-ink-mid">VAriable recommends one</span>
              </span>
            </label>
          </div>
        </Group>
        <Group legend="Commitment" error={e.commitment}>
          <div className="grid gap-2 sm:grid-cols-3">
            {COMMITMENTS.map((c) => (
              <label key={c.value} className={choice}>
                <input type="radio" name="commitment" value={c.value} defaultChecked={v("commitment") === c.value} className="mt-0.5 accent-black" />
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-ink-mid">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Group>
        <label className={choice}>
          <input type="checkbox" name="ai_agent_build" defaultChecked={v("ai_agent_build") === "on"} className="mt-0.5 accent-black" />
          <span>
            <span className="font-medium">Add a Custom AI Agent Build</span>
            <span className="block text-xs text-ink-mid">
              Jhona designs AI agents for your workflows, and your hire is trained to run them.
            </span>
          </span>
        </label>
      </Section>

      <Section n="04" title="About you">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Your name" htmlFor="contact_name" error={e.contact_name}>
            <input id="contact_name" name="contact_name" autoComplete="name" defaultValue={v("contact_name", defaults.contact_name ?? "")} className={input} {...aria("contact_name", e.contact_name)} />
          </Field>
          <Field label="Work email" htmlFor="contact_email" error={e.contact_email}>
            <input id="contact_email" name="contact_email" type="email" autoComplete="email" defaultValue={v("contact_email", defaults.contact_email ?? "")} className={input} {...aria("contact_email", e.contact_email)} />
          </Field>
          <Field label="Company" htmlFor="company" error={e.company}>
            <input id="company" name="company" autoComplete="organization" defaultValue={v("company")} className={input} {...aria("company", e.company)} />
          </Field>
          <Field label="Company website" hint="Optional." htmlFor="company_website" error={e.company_website}>
            <input id="company_website" name="company_website" inputMode="url" defaultValue={v("company_website")} className={input} />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-mid">No charge until your hire starts working.</p>
        <button type="submit" disabled={pending} className={`${btnPrimary} disabled:opacity-50`}>
          {pending ? "Sending" : "Send request"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
