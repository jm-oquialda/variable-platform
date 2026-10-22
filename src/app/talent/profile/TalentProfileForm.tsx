"use client";

import { useActionState } from "react";
import { btnPrimary, btnSecondary, input, notice } from "@/components/ui";
import { NICHES } from "@/lib/niches";
import { OVERLAPS, TALENT_SCHEDULES } from "@/lib/talent";
import { saveTalentProfile, type TalentProfileState } from "./actions";

const choice =
  "flex cursor-pointer items-center gap-3 border border-line bg-card px-4 py-3 text-sm transition has-[:checked]:border-ink has-[:checked]:bg-accent-bg";

function Section({ n, title, intro, children }: { n: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 md:grid-cols-[220px_1fr]">
      <div>
        <span className="text-xs text-ink-soft">{n}</span>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        {intro && <p className="mt-2 text-xs leading-relaxed text-ink-mid">{intro}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function FieldShell({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-mid">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function TalentProfileForm({
  initial,
  submitted,
  resumeLabel,
  hasConsent,
}: {
  initial: Record<string, string>;
  submitted: boolean;
  resumeLabel: string | null;
  hasConsent: boolean;
}) {
  const [state, action, pending] = useActionState<TalentProfileState, FormData>(saveTalentProfile, {});
  const v = (name: string) => state.values?.[name] ?? initial[name] ?? "";
  const e = state.errors ?? {};
  const field = (name: keyof typeof e) =>
    ({
      id: name,
      name,
      defaultValue: v(name),
      className: input,
      ...(e[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {}),
    }) as const;

  return (
    <form key={state.attempt ?? 0} action={action} noValidate>
      {state.saved && (
        <p role="status" className={`${notice} mb-6`}>
          {state.saved === "submitted"
            ? "Profile submitted. VAriable will be in touch about next steps."
            : "Saved. You can come back and finish any time."}
        </p>
      )}
      {(state.formError || Object.keys(e).length > 0) && (
        <p role="alert" className={`${notice} mb-6`}>
          {state.formError ?? "Check the highlighted answers below."}
          {e.resume && state.values ? " Choose your resume file again." : ""}
        </p>
      )}

      <Section n="01" title="About you" intro="Clients only ever see your first name and last initial. Your phone number stays with VAriable.">
        <div className="grid gap-6 sm:grid-cols-2">
          <FieldShell name="first_name" error={e.first_name} label="First name">
            <input {...field("first_name")} autoComplete="given-name" />
          </FieldShell>
          <FieldShell name="last_name" error={e.last_name} label="Last name">
            <input {...field("last_name")} autoComplete="family-name" />
          </FieldShell>
          <FieldShell name="phone" error={e.phone} label="Phone" hint="Include the country code, for example +63.">
            <input {...field("phone")} type="tel" autoComplete="tel" />
          </FieldShell>
          <FieldShell name="city" error={e.city} label="City" hint="Optional.">
            <input {...field("city")} autoComplete="address-level2" />
          </FieldShell>
        </div>
      </Section>

      <Section n="02" title="Your role">
        <FieldShell name="niche" error={e.niche} label="Main role">
          <select {...field("niche")}>
            <option value="">Choose a role</option>
            {NICHES.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell name="headline" error={e.headline} label="Headline" hint="One line, for example: EA for startup founders, 5 years in SaaS.">
          <input {...field("headline")} maxLength={140} />
        </FieldShell>
        <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
          <FieldShell name="years_experience" error={e.years_experience} label="Years of experience">
            <input {...field("years_experience")} inputMode="numeric" />
          </FieldShell>
          <FieldShell name="skills" error={e.skills} label="Skills" hint="Separate with commas.">
            <input {...field("skills")} />
          </FieldShell>
        </div>
        <FieldShell name="tools" error={e.tools} label="Tools you use" hint="Separate with commas, for example Google Workspace, HubSpot, Clay.">
          <input {...field("tools")} />
        </FieldShell>
        <FieldShell name="summary" error={e.summary} label="Summary" hint="What you have done, for whom, and what you are best at.">
          <textarea {...field("summary")} rows={5} maxLength={2000} />
        </FieldShell>
      </Section>

      <Section n="03" title="Links and video" intro="Your intro video is shown to matched clients. Keep it under two minutes.">
        <FieldShell name="intro_video_url" error={e.intro_video_url} label="Intro video link" hint="Loom or unlisted YouTube.">
          <input {...field("intro_video_url")} inputMode="url" placeholder="https://www.loom.com/share/..." />
        </FieldShell>
        <div className="grid gap-6 sm:grid-cols-2">
          <FieldShell name="portfolio_url" error={e.portfolio_url} label="Portfolio" hint="Optional.">
            <input {...field("portfolio_url")} inputMode="url" />
          </FieldShell>
          <FieldShell name="linkedin_url" error={e.linkedin_url} label="LinkedIn" hint="Optional.">
            <input {...field("linkedin_url")} inputMode="url" />
          </FieldShell>
        </div>
      </Section>

      <Section n="04" title="Availability">
        <fieldset>
          <legend className="text-sm font-medium">Hours</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {TALENT_SCHEDULES.map((s) => (
              <label key={s.value} className={choice}>
                <input type="radio" name="schedule" value={s.value} defaultChecked={v("schedule") === s.value} className="accent-black" />
                {s.label}
              </label>
            ))}
          </div>
          {e.schedule && <p className="mt-1.5 text-xs font-medium">{e.schedule}</p>}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">US hours you can work</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {OVERLAPS.map((o) => (
              <label key={o.value} className={choice}>
                <input type="radio" name="overlap" value={o.value} defaultChecked={v("overlap") === o.value} className="accent-black" />
                {o.label}
              </label>
            ))}
          </div>
          {e.overlap && <p className="mt-1.5 text-xs font-medium">{e.overlap}</p>}
        </fieldset>
        <div className="max-w-xs">
          <FieldShell name="available_from" error={e.available_from} label="Available from" hint="Optional.">
            <input {...field("available_from")} type="date" />
          </FieldShell>
        </div>
      </Section>

      <Section
        n="05"
        title="Rate and resume"
        intro="Your asking rate is private. Clients never see it; VAriable uses it to price your placement."
      >
        <div className="max-w-xs">
          <FieldShell name="monthly_rate" error={e.monthly_rate} label="Monthly asking rate (USD)" hint="Full time, before any deductions.">
            <div className="flex items-center gap-2">
              <span className="text-ink-mid">$</span>
              <input {...field("monthly_rate")} inputMode="decimal" />
            </div>
          </FieldShell>
        </div>
        <FieldShell name="resume" error={e.resume} label="Resume" hint="PDF or Word, up to 5 MB. Only VAriable sees this file.">
          {resumeLabel && (
            <p className="mb-2 text-sm">
              Current file:{" "}
              <a href="/talent/resume" target="_blank" rel="noopener" className="underline">
                {resumeLabel}
              </a>
            </p>
          )}
          <input
            id="resume"
            name="resume"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block w-full text-sm file:mr-4 file:rounded-full file:border file:border-line file:bg-card file:px-4 file:py-1.5 file:text-sm file:font-medium"
          />
        </FieldShell>
        {!hasConsent && (
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="privacy_consent" defaultChecked={v("privacy_consent") === "on"} className="mt-1 accent-black" />
              <span>
                I agree that VAriable may store and process my details to vet me and match me with clients, under the
                Philippine Data Privacy Act. I can ask VAriable to delete my data at any time.
              </span>
            </label>
            {e.privacy_consent && <p className="mt-1.5 text-xs font-medium">{e.privacy_consent}</p>}
          </div>
        )}
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-end">
        <button type="submit" name="intent" value="draft" disabled={pending} className={`${btnSecondary} disabled:opacity-50`}>
          Save {submitted ? "changes" : "draft"}
        </button>
        {!submitted && (
          <button type="submit" name="intent" value="submit" disabled={pending} className={`${btnPrimary} disabled:opacity-50`}>
            {pending ? "Saving" : "Submit for review"} <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </form>
  );
}
