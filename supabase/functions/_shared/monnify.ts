import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

export type MonnifyVerification = {
  requestSuccessful?: boolean;
  responseBody?: {
    paymentReference?: string;
    paymentStatus?: string;
    amountPaid?: number;
    currency?: string;
    currencyCode?: string;
  };
};

export function getMonnifyBaseUrl() {
  return Deno.env.get("MONNIFY_ENVIRONMENT") === "live"
    ? "https://api.monnify.com"
    : "https://sandbox.monnify.com";
}

export async function getMonnifyAccessToken() {
  const apiKey = Deno.env.get("MONNIFY_API_KEY");
  const clientSecret = Deno.env.get("MONNIFY_CLIENT_SECRET");
  if (!apiKey || !clientSecret) throw new Error("Monnify server credentials are not configured");

  const credentials = btoa(`${apiKey}:${clientSecret}`);
  const response = await fetch(`${getMonnifyBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` }
  });
  const result = await response.json();
  const token = result?.responseBody?.accessToken;
  if (!response.ok || result?.requestSuccessful !== true || !token) {
    throw new Error("Monnify authentication failed");
  }
  return token as string;
}

export async function initializeMonnifyTransaction(input: {
  amount: number;
  customerEmail: string;
  customerName: string;
  customerMobileNumber: string;
  paymentReference: string;
  orderId: string;
}) {
  const contractCode = Deno.env.get("MONNIFY_CONTRACT_CODE");
  const siteUrl = (Deno.env.get("COSSIRAE_SITE_URL") || "https://cossirae.vercel.app").replace(/\/$/, "");
  if (!contractCode) throw new Error("Monnify contract code is not configured");
  const token = await getMonnifyAccessToken();
  const response = await fetch(`${getMonnifyBaseUrl()}/api/v1/merchant/transactions/init-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: input.amount,
      customerEmail: input.customerEmail,
      paymentReference: input.paymentReference,
      paymentDescription: `Cossirae order ${input.orderId}`,
      currencyCode: "NGN",
      contractCode,
      redirectUrl: `${siteUrl}/payment-return.html?order_id=${encodeURIComponent(input.orderId)}`,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"],
      metadata: {
        orderId: input.orderId,
        customerName: input.customerName,
        customerMobileNumber: input.customerMobileNumber
      }
    })
  });
  const result = await response.json();
  const checkoutUrl = result?.responseBody?.checkoutUrl;
  if (!response.ok || result?.requestSuccessful !== true || !checkoutUrl) {
    throw new Error("Monnify could not initialize the transaction");
  }
  return checkoutUrl as string;
}

export async function verifyMonnifyTransaction(paymentReference: string): Promise<MonnifyVerification> {
  const token = await getMonnifyAccessToken();
  const url = new URL(`${getMonnifyBaseUrl()}/api/v2/merchant/transactions/query`);
  url.searchParams.set("paymentReference", paymentReference);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok || result?.requestSuccessful !== true) {
    throw new Error("Monnify transaction verification failed");
  }
  return result as MonnifyVerification;
}

export function isMonnifyWebhookValid(secret: string, rawBody: string, signature: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  ).then(async (key) => {
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (expected.length !== signature.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
    }
    return difference === 0;
  });
}

export function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are not configured");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return { client, supabaseUrl, serviceRoleKey };
}

async function notifyOrderEmail(supabaseUrl: string, serviceRoleKey: string, order: Record<string, unknown>) {
  await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(order)
  });
}

export async function confirmOrderPayment(paymentReference: string, verification: MonnifyVerification) {
  const payment = verification.responseBody;
  if (payment?.paymentStatus !== "PAID") return { paid: false, newlyPaid: false };

  const { client, supabaseUrl, serviceRoleKey } = getServiceClient();
  const { data: order, error: readError } = await client
    .from("orders")
    .select("*")
    .eq("payment_reference", paymentReference)
    .maybeSingle();
  if (readError) throw new Error("Could not load the order for payment verification");
  if (!order || order.payment_method !== "monnify") return { paid: false, newlyPaid: false };
  if (order.payment_status === "paid") return { paid: true, newlyPaid: false };

  const receivedAmount = Number(payment.amountPaid);
  const receivedCurrency = payment.currencyCode || payment.currency;
  if (!Number.isFinite(receivedAmount) || receivedAmount < Number(order.total_ngn) || receivedCurrency !== "NGN") {
    return { paid: false, newlyPaid: false };
  }

  const { data: updatedOrder, error: updateError } = await client
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select("*")
    .maybeSingle();
  if (updateError) throw new Error("Could not update the order payment status");
  if (updatedOrder) await notifyOrderEmail(supabaseUrl, serviceRoleKey, updatedOrder);
  return { paid: Boolean(updatedOrder), newlyPaid: Boolean(updatedOrder) };
}
