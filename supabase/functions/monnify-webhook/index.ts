import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  confirmOrderPayment,
  getServiceClient,
  isMonnifyWebhookValid,
  verifyMonnifyTransaction
} from "../_shared/monnify.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const environment = Deno.env.get("MONNIFY_ENVIRONMENT") || "sandbox";
    if (environment === "live") {
      const clientSecret = Deno.env.get("MONNIFY_CLIENT_SECRET");
      const signature = req.headers.get("monnify-signature") || "";
      if (!clientSecret || !signature || !await isMonnifyWebhookValid(clientSecret, rawBody, signature)) {
        return json({ error: "Invalid webhook signature" }, 401);
      }
    }

    const event = JSON.parse(rawBody);
    if (event?.eventType !== "SUCCESSFUL_TRANSACTION") return json({ received: true });

    const paymentReference = event?.eventData?.paymentReference;
    if (typeof paymentReference !== "string" || !paymentReference) return json({ error: "Missing payment reference" }, 400);

    const { client } = getServiceClient();
    await client.from("app_logs").insert({
      level: "info",
      source: "monnify-webhook",
      message: event.eventType,
      context: { paymentReference, paymentMethod: event.eventData?.paymentMethod }
    });

    const verification = await verifyMonnifyTransaction(paymentReference);
    await confirmOrderPayment(paymentReference, verification);
    return json({ received: true });
  } catch (error) {
    console.error("Monnify webhook processing failed", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
