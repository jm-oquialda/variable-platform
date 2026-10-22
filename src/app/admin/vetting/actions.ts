"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ALL_STATUSES } from "@/lib/vetting-store";

// Server actions are public endpoints, so each checks the role itself.
// Row-level security and set_vetting_status() check again in the database.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function back(talentId: string, query: string): never {
  revalidatePath(`/admin/vetting/${talentId}`);
  revalidatePath("/admin/vetting");
  revalidatePath("/admin/funnel");
  redirect(`/admin/vetting/${talentId}?${query}`);
}

export async function changeVettingStatus(formData: FormData) {
  await requireRole("admin");
  const talentId = field(formData, "talent_id");
  const status = field(formData, "status");
  const note = field(formData, "note").slice(0, 2000);
  if (!UUID.test(talentId)) redirect("/admin/vetting");
  if (!(ALL_STATUSES as readonly string[]).includes(status)) back(talentId, "error=status");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vetting_status", {
    p_talent_id: talentId,
    p_status: status,
    p_note: note || null,
  });
  if (error) {
    console.error("vetting status change failed", error.message);
    back(talentId, "error=save");
  }
  back(talentId, "saved=status");
}

const SCORES = ["communication", "written_english", "role_skills", "ai_tools", "reliability"] as const;

export async function saveScorecard(formData: FormData) {
  const admin = await requireRole("admin");
  const talentId = field(formData, "talent_id");
  if (!UUID.test(talentId)) redirect("/admin/vetting");

  const values: Record<string, number | string | null> = {};
  for (const s of SCORES) {
    const raw = field(formData, s);
    if (!raw) {
      values[s] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) back(talentId, "error=score");
    values[s] = n;
  }
  values.notes = field(formData, "notes").slice(0, 4000) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("vetting_scorecards")
    .upsert({ talent_id: talentId, ...values, updated_by: admin.id }, { onConflict: "talent_id" });
  if (error) {
    console.error("scorecard save failed", error.message);
    back(talentId, "error=save");
  }
  back(talentId, "saved=scorecard");
}
