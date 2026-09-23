import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

async function hmacSha512(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing server secrets" }, 500);
  }

  const expectedSignature = await hmacSha512(paystackSecretKey, rawBody);
  if (signature !== expectedSignature) {
    return json({ error: "Invalid signature" }, 401);
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await supabase.from("app_logs").insert({
    level: "info",
    source: "paystack-webhook",
    message: event.event || "paystack.event",
    context: event
  });

  if (event.event === "charge.success") {
    const reference = event.data?.reference;
    if (reference) {
      await supabase
        .from("orders")
        .update({ payment_status: "paid", payment_reference: reference })
        .eq("payment_reference", reference);

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_reference", reference)
        .maybeSingle();

      if (order) {
        await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${serviceRoleKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(order)
        });
      }
    }
  }

  return json({ received: true });
});
