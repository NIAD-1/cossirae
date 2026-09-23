import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type"
    }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("ORDER_EMAIL_FROM") || "Cossirae <orders@cossirae.ng>";
  const adminEmail = Deno.env.get("ORDER_ADMIN_EMAIL") || "orders@cossirae.ng";
  const order = await req.json();

  if (!resendApiKey) {
    return json({ queued: false, error: "RESEND_API_KEY is not configured" }, 200);
  }

  const subject = `Cossirae order ${order.payment_reference || order.id || ""}`.trim();
  const html = `
    <h1>New Cossirae Order</h1>
    <p><strong>Customer:</strong> ${order.customer_name || ""}</p>
    <p><strong>Email:</strong> ${order.customer_email || ""}</p>
    <p><strong>Phone:</strong> ${order.customer_phone || ""}</p>
    <p><strong>Total:</strong> ₦${Number(order.total_ngn || 0).toLocaleString("en-NG")}</p>
    <p><strong>Status:</strong> ${order.payment_status || "pending"}</p>
  `;

  const payloads = [
    { from: fromEmail, to: [adminEmail], subject, html },
    order.customer_email ? { from: fromEmail, to: [order.customer_email], subject: "Your Cossirae order", html: `<p>Thank you for shopping Cossirae. We have received your order.</p>${html}` } : null
  ].filter(Boolean);

  const results = [];
  for (const payload of payloads) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    results.push(await response.json());
  }

  return json({ queued: true, results });
});
