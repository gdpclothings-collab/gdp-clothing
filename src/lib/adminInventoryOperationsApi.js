import { supabase } from "@/lib/supabaseClient";

export const adminInventoryOperationsApi = {
  async locations() {
    const { data, error } = await supabase
      .from("inventory_locations")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async locationLevels(locationId) {
    const { data, error } = await supabase
      .from("inventory_levels")
      .select(
        "id, location_id, variant_id, available, committed, incoming, updated_at, product_variants!inner(id, name, sku, color, size, active, products!inner(id, name, images, status))"
      )
      .eq("location_id", locationId)
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  },

  async variants() {
    const { data, error } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, name, sku, stock, color, size, active, products!inner(id, name, images, status)"
      )
      .eq("active", true)
      .neq("products.status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  },

  async adjustments() {
    const { data, error } = await supabase
      .from("inventory_adjustments")
      .select(
        "id, location_id, variant_id, adjustment, before_quantity, after_quantity, reason, note, actor_user_id, created_at, inventory_locations(name, code), product_variants!inner(name, sku, color, size, products!inner(name))"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async transfers() {
    const { data, error } = await supabase
      .from("inventory_transfers")
      .select(
        "id, transfer_number, from_location_id, to_location_id, status, note, shipped_at, received_at, created_at, updated_at, from_location:inventory_locations!inventory_transfers_from_location_id_fkey(id,name,code), to_location:inventory_locations!inventory_transfers_to_location_id_fkey(id,name,code), inventory_transfer_items(id, variant_id, quantity, received_quantity, product_variants!inner(id,name,sku,color,size,products!inner(name)))"
      )
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw error;
    return data || [];
  },

  async createLocation(payload) {
    if (payload.isDefault) {
      await supabase
        .from("inventory_locations")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("inventory_locations")
      .insert({
        code: String(payload.code || "").trim().toUpperCase(),
        name: String(payload.name || "").trim(),
        address: payload.address || {},
        active: payload.active !== false,
        is_default: Boolean(payload.isDefault),
        fulfills_online: payload.fulfillsOnline !== false,
        sort_order: Number(payload.sortOrder || 0),
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async updateLocation(id, payload) {
    if (payload.isDefault) {
      await supabase
        .from("inventory_locations")
        .update({ is_default: false })
        .neq("id", id)
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("inventory_locations")
      .update({
        code: String(payload.code || "").trim().toUpperCase(),
        name: String(payload.name || "").trim(),
        address: payload.address || {},
        active: payload.active !== false,
        is_default: Boolean(payload.isDefault),
        fulfills_online: payload.fulfillsOnline !== false,
        sort_order: Number(payload.sortOrder || 0),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async adjustStock({ variantId, locationId, newAvailable, reason = "manual", note = null }) {
    const { data, error } = await supabase.rpc("admin_adjust_inventory", {
      p_variant_id: variantId,
      p_location_id: locationId,
      p_new_available: Number(newAvailable || 0),
      p_reason: reason,
      p_note: note,
    });

    if (error) throw error;
    return data;
  },

  async createTransfer({ fromLocationId, toLocationId, note, items }) {
    const transferNumber = `TRF-${Date.now().toString().slice(-8)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const { data: transfer, error } = await supabase
      .from("inventory_transfers")
      .insert({
        transfer_number: transferNumber,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        status: "draft",
        note: note || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    const cleanItems = (items || []).filter((item) => Number(item.quantity || 0) > 0);
    if (!cleanItems.length) {
      await supabase.from("inventory_transfers").delete().eq("id", transfer.id);
      throw new Error("Add at least one transfer item.");
    }

    const { error: itemError } = await supabase
      .from("inventory_transfer_items")
      .insert(
        cleanItems.map((item) => ({
          transfer_id: transfer.id,
          variant_id: item.variantId,
          quantity: Number(item.quantity),
        }))
      );

    if (itemError) {
      await supabase.from("inventory_transfers").delete().eq("id", transfer.id);
      throw itemError;
    }

    return transfer;
  },

  async setReceivedQuantity(itemId, quantity) {
    const { error } = await supabase
      .from("inventory_transfer_items")
      .update({ received_quantity: Math.max(0, Number(quantity || 0)) })
      .eq("id", itemId);

    if (error) throw error;
  },

  async transitionTransfer(transferId, status) {
    const { data, error } = await supabase.rpc("admin_transition_inventory_transfer", {
      p_transfer_id: transferId,
      p_next_status: status,
    });

    if (error) throw error;
    return data;
  },
};
