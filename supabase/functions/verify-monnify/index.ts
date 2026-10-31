import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { confirmOrderPayment, getServiceClient, verifyMonnifyTransaction } from "../_shared/monnify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const { payment_reference, order_id } = await req.json();
    if (typeof payment_reference !== "string" || typeof order_id !== "string") {
      return Response.json({ error: "Missing payment reference or order id" }, { status: 400, headers: corsHeaders });
    }

    const { client } = getServiceClient();
    const { data: order, error } = await client
      .from("orders")
      .select("id,payment_reference,payment_status,payment_method")
      .eq("id", order_id)
      .eq("payment_reference", payment_reference)
      .maybeSingle();
    if (error) throw new Error("Could not load the pending order");
    if (!order || order.payment_method !== "monnify") {
      return Response.json({ error: "Order not found" }, { status: 404, headers: corsHeaders });
    }
    if (order.payment_status === "paid") return Response.json({ paid: true }, { headers: corsHeaders });

    const verification = await verifyMonnifyTransaction(payment_reference);
    const result = await confirmOrderPayment(payment_reference, verification);
    return Response.json({ paid: result.paid }, { headers: corsHeaders });
  } catch (error) {
    console.error("Monnify verification failed", error);
    return Response.json({ error: "Payment verification failed" }, { status: 500, headers: corsHeaders });
  }
});
