import { supabase } from "@/lib/supabaseClient";

let bootstrapPromise = null;

async function functionErrorMessage(error, fallback) {
  try {
    const context = error?.context;
    const response = typeof context?.clone === "function" ? context.clone() : context;
    const payload = await response?.json?.();
    if (payload?.message) return payload.message;
  } catch {
    // Network and relay failures do not always include a JSON response body.
  }
  return error?.message || fallback;
}

async function invokePaymentSession(action, body = {}, fallback = "Secure payment is temporarily unavailable.") {
  const { data, error } = await supabase.functions.invoke("payment-session", {
    body: { action, ...body },
  });

  if (error) throw new Error(await functionErrorMessage(error, fallback));
  if (data?.error) throw new Error(data.message || fallback);
  return data;
}

export const paymentApi = {
  async getBootstrap() {
    if (!bootstrapPromise) {
      bootstrapPromise = invokePaymentSession("bootstrap", {}, "Could not load secure payment.")
        .catch((error) => {
          bootstrapPromise = null;
          throw error;
        });
    }
    return bootstrapPromise;
  },

  async createPaymentIntent({ orderNumber, confirmationToken, checkoutSessionToken }) {
    return invokePaymentSession(
      "createIntent",
      { orderNumber, confirmationToken, checkoutSessionToken },
      "Could not prepare the payment. Please try again."
    );
  },
};
