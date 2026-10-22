"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { STAGES } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/server";

function done(query: string): never {
  revalidatePath("/admin/funnel");
  redirect(`/admin/funnel?${query}`);
}

// Adds or replaces the past counts for one month and source.
export async function savePastCounts(formData: FormData) {
  await requireRole("admin");
  const monthInput = String(formData.get("month") ?? "").trim(); // YYYY-MM from <input type="month">
  const source = String(formData.get("source") ?? "").trim().slice(0, 60);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput)) done("error=month");
  if (!source) done("error=source");

  const counts: Record<string, number> = {};
  for (const stage of STAGES) {
    const raw = String(formData.get(stage) ?? "").trim();
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) done("error=count");
    counts[stage] = n;
  }
  if (counts.applied === 0) done("error=applied");
  if (STAGES.some((s) => counts[s] > counts.applied)) done("error=order");

  const supabase = await createClient();
  const { error } = await supabase
    .from("historical_funnel_counts")
    .upsert({ month: `${monthInput}-01`, source, ...counts }, { onConflict: "month,source" });
  if (error) {
    console.error("past counts save failed", error.message);
    done("error=save");
  }
  done("saved=counts");
}

export async function deletePastCounts(formData: FormData) {
  await requireRole("admin");
  const month = String(formData.get("month") ?? "");
  const source = String(formData.get("source") ?? "");
  if (!/^\d{4}-\d{2}-01$/.test(month) || !source) done("error=save");

  const supabase = await createClient();
  const { error } = await supabase.from("historical_funnel_counts").delete().eq("month", month).eq("source", source);
  if (error) done("error=save");
  done("saved=deleted");
}
