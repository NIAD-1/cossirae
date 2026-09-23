import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference, order_id } = await req.json();
    if (!reference || !order_id) {
      return Response.json({ error: "Missing reference or order_id" }, { status: 400, headers: corsHeaders });
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Server is missing required environment variables" }, { status: 500, headers: corsHeaders });
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` }
    });
    const verification = await verifyResponse.json();
    const isPaid = verification?.status === true && verification?.data?.status === "success";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: isPaid ? "paid" : "failed",
        payment_reference: reference
      })
      .eq("id", order_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ paid: isPaid, verification }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
