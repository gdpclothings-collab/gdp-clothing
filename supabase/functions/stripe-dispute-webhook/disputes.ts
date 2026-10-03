function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as any).id === "string") {
    return (value as any).id;
  }
  return null;
}

function stripeTimestamp(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export async function handleStripeDispute(
  service: any,
  event: any,
  matchedMode: "live" | "test",
) {
  const dispute = event?.data?.object;
  const disputeId = typeof dispute?.id === "string" ? dispute.id : null;
  const paymentIntentId = stripeObjectId(dispute?.payment_intent);
  const chargeId = stripeObjectId(dispute?.charge);

  if (!disputeId || !paymentIntentId) {
    console.error("stripe dispute missing required identifiers", {
      event_id: event?.id || null,
      dispute_id: disputeId,
      payment_intent_id: paymentIntentId,
    });
    return { recorded: false, reason: "missing_identifiers" };
  }

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id,payment_mode")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (orderError) throw orderError;

  if (!order) {
    console.error("stripe dispute has no matching GDP order", {
      event_id: event?.id || null,
      dispute_id: disputeId,
      payment_intent_id: paymentIntentId,
      mode: matchedMode,
    });
    return { recorded: false, reason: "order_not_found" };
  }

  if (order.payment_mode !== matchedMode) {
    throw new Error("Dispute payment environment mismatch.");
  }

  const incomingEventCreated = stripeTimestamp(event?.created) || new Date().toISOString();
  const incomingEventMs = Date.parse(incomingEventCreated);

  const { data: existing, error: existingError } = await service
    .from("payment_disputes")
    .select("last_event_id,last_event_created")
    .eq("stripe_dispute_id", disputeId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.last_event_id === event?.id) {
    return { recorded: false, reason: "duplicate_event" };
  }

  const existingEventMs = existing?.last_event_created
    ? Date.parse(existing.last_event_created)
    : Number.NEGATIVE_INFINITY;
  if (Number.isFinite(existingEventMs) && existingEventMs > incomingEventMs) {
    return { recorded: false, reason: "stale_event" };
  }

  const evidence = dispute?.evidence_details || {};
  const status = typeof dispute?.status === "string" ? dispute.status : "unknown";
  const reason = typeof dispute?.reason === "string" ? dispute.reason : null;
  const currency = typeof dispute?.currency === "string" ? dispute.currency.toLowerCase() : "unknown";
  const amount = Number.isFinite(Number(dispute?.amount))
    ? Math.max(0, Math.trunc(Number(dispute.amount)))
    : 0;
  const submissionCount = Number.isFinite(Number(evidence?.submission_count))
    ? Math.max(0, Math.trunc(Number(evidence.submission_count)))
    : null;

  const { error: disputeError } = await service
    .from("payment_disputes")
    .upsert({
      stripe_dispute_id: disputeId,
      order_id: order.id,
      payment_mode: matchedMode,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      status,
      reason,
      amount,
      currency,
      evidence_due_by: stripeTimestamp(evidence?.due_by),
      evidence_past_due: typeof evidence?.past_due === "boolean" ? evidence.past_due : null,
      evidence_submission_count: submissionCount,
      last_event_id: String(event?.id || "unknown"),
      last_event_type: String(event?.type || "unknown"),
      last_event_created: incomingEventCreated,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_dispute_id" });
  if (disputeError) throw disputeError;

  if (status !== "won" && status !== "warning_closed") {
    const { error: priorityError } = await service
      .from("orders")
      .update({ priority: "due_soon" })
      .eq("id", order.id)
      .eq("priority", "standard");
    if (priorityError) throw priorityError;
  }

  console.log("stripe dispute recorded", {
    event_id: event?.id || null,
    event_type: event?.type || null,
    dispute_id: disputeId,
    order_id: order.id,
    status,
    reason,
    mode: matchedMode,
  });

  return { recorded: true, order_id: order.id, dispute_id: disputeId, status };
}
