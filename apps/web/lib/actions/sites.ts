"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { slugify } from "../utils";
import type { PipelineStage } from "@repo/supabase";

export async function createSite(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType && claims.tenantType !== "internal") throw new Error("Forbidden");

  const customerId = formData.get("customerId") as string;
  const customerTenantId = formData.get("customerTenantId") as string;
  const name = formData.get("name") as string;
  const address = (formData.get("address") as string) || null;
  const city = (formData.get("city") as string) || null;
  const state = (formData.get("state") as string) || null;
  const slug = slugify(name);

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("sites").insert({
    customer_id: customerId,
    tenant_id: customerTenantId,
    name,
    slug,
    address,
    city,
    state,
    pipeline_stage: "prospect" as PipelineStage,
  });

  if (error) throw error;

  revalidatePath("/customers");
}

export async function updateSitePipelineStage(
  siteId: string,
  stage: PipelineStage,
  dqReason?: string,
  dqReevalDate?: string,
) {
  const { claims } = await requireSession();
  if (claims.tenantType && claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("sites")
    .update({
      pipeline_stage: stage,
      dq_reason: stage === "disqualified" ? (dqReason ?? null) : null,
      dq_reeval_date: stage === "disqualified" ? (dqReevalDate ?? null) : null,
    })
    .eq("id", siteId);

  if (error) throw error;

  revalidatePath("/customers");
}
