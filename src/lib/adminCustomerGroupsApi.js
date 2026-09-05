import { supabase } from "@/lib/supabaseClient";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

async function customerDirectory() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_email, customer_name, customer_phone, total, payment_status, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const map = new Map();

  for (const order of data || []) {
    const email = normalizeEmail(order.customer_email);
    if (!email) continue;

    if (!map.has(email)) {
      map.set(email, {
        email,
        name: order.customer_name || "Customer",
        phone: order.customer_phone || "",
        orders: 0,
        paidOrders: 0,
        totalSpent: 0,
        lastOrderAt: order.created_at,
      });
    }

    const customer = map.get(email);
    customer.orders += 1;

    if (order.payment_status === "paid") {
      customer.paidOrders += 1;
      customer.totalSpent += Number(order.total || 0);
    }

    if (order.customer_name) customer.name = order.customer_name;
    if (order.customer_phone) customer.phone = order.customer_phone;
    if (String(order.created_at) > String(customer.lastOrderAt)) {
      customer.lastOrderAt = order.created_at;
    }
  }

  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

export const adminCustomerGroupsApi = {
  async load() {
    const [tagsResult, assignmentsResult, segmentsResult, membersResult, customers] =
      await Promise.all([
        supabase.from("customer_tags").select("*").order("name"),
        supabase
          .from("customer_tag_assignments")
          .select("*, customer_tags(id,name,color)")
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_segments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_segment_members")
          .select("*")
          .order("created_at", { ascending: false }),
        customerDirectory(),
      ]);

    for (const result of [
      tagsResult,
      assignmentsResult,
      segmentsResult,
      membersResult,
    ]) {
      if (result.error) throw result.error;
    }

    return {
      tags: tagsResult.data || [],
      assignments: assignmentsResult.data || [],
      segments: segmentsResult.data || [],
      members: membersResult.data || [],
      customers,
    };
  },

  async saveTag(id, payload) {
    const row = {
      name: String(payload.name || "").trim(),
      color: payload.color || null,
      description: payload.description || null,
    };

    const query = id
      ? supabase.from("customer_tags").update(row).eq("id", id)
      : supabase.from("customer_tags").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async assignTag(customerEmail, tagId) {
    const { error } = await supabase
      .from("customer_tag_assignments")
      .upsert(
        {
          customer_email: normalizeEmail(customerEmail),
          tag_id: tagId,
        },
        { onConflict: "customer_email,tag_id" }
      );

    if (error) throw error;
  },

  async removeTag(customerEmail, tagId) {
    const { error } = await supabase
      .from("customer_tag_assignments")
      .delete()
      .eq("customer_email", normalizeEmail(customerEmail))
      .eq("tag_id", tagId);

    if (error) throw error;
  },

  async saveSegment(id, payload) {
    const row = {
      name: String(payload.name || "").trim(),
      description: payload.description || null,
      segment_type: payload.segmentType || "manual",
      rules: payload.rules || {},
      active: payload.active !== false,
    };

    const query = id
      ? supabase.from("customer_segments").update(row).eq("id", id)
      : supabase.from("customer_segments").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async replaceManualMembers(segmentId, emails) {
    const { error: clearError } = await supabase
      .from("customer_segment_members")
      .delete()
      .eq("segment_id", segmentId);

    if (clearError) throw clearError;

    const clean = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];

    if (!clean.length) return;

    const { error } = await supabase
      .from("customer_segment_members")
      .insert(
        clean.map((email) => ({
          segment_id: segmentId,
          customer_email: email,
        }))
      );

    if (error) throw error;
  },

  async setSegmentActive(id, active) {
    const { error } = await supabase
      .from("customer_segments")
      .update({ active: Boolean(active) })
      .eq("id", id);

    if (error) throw error;
  },
};
