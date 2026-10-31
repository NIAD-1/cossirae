import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, initializeMonnifyTransaction } from "../_shared/monnify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: corsHeaders });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  let orderId = "";
  try {
    const body = await req.json();
    const customer = body?.customer || {};
    const name = cleanText(customer.name, 120);
    const email = cleanText(customer.email, 254).toLowerCase();
    const phone = cleanText(customer.phone, 32);
    const address = cleanText(customer.address, 300);
    const city = cleanText(customer.city, 100);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !address || !city) {
      return fail("Please provide valid customer and delivery details", 400);
    }
    if (!items.length || items.length > 30) return fail("Invalid order items", 400);

    const quantities = new Map<string, number>();
    for (const item of items) {
      const slug = cleanText(item?.slug, 120);
      const quantity = Number(item?.quantity);
      if (!slug || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return fail("Invalid product or quantity", 400);
      }
      quantities.set(slug, (quantities.get(slug) || 0) + quantity);
    }

    const { client, supabaseUrl, serviceRoleKey } = getServiceClient();
    const slugs = [...quantities.keys()];
    const { data: products, error: productsError } = await client
      .from("products")
      .select("slug,name,price_ngn,stock_quantity,is_active")
      .in("slug", slugs);
    if (productsError) throw new Error("Could not load products for checkout");
    if (!products || products.length !== slugs.length) return fail("One or more products are no longer available", 409);

    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    let total = 0;
    const orderItems = [];
    for (const [slug, quantity] of quantities) {
      const product = productBySlug.get(slug);
      if (!product || product.is_active !== true) return fail("One or more products are no longer available", 409);
      if (quantity > Number(product.stock_quantity)) return fail(`${product.name} does not have enough stock`, 409);
      const unitPrice = Number(product.price_ngn);
      if (!Number.isInteger(unitPrice) || unitPrice <= 0) return fail(`${product.name} cannot currently be purchased`, 409);
      total += unitPrice * quantity;
      orderItems.push({
        product_slug: product.slug,
        product_name: product.name,
        quantity,
        unit_price_ngn: unitPrice,
        line_total_ngn: unitPrice * quantity
      });
    }

    orderId = crypto.randomUUID();
    const paymentReference = `cossirae-${crypto.randomUUID()}`;
    const { error: orderError } = await client.from("orders").insert({
      id: orderId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      delivery_address: address,
      delivery_city: city,
      payment_method: "monnify",
      payment_reference: paymentReference,
      payment_status: "pending",
      subtotal_ngn: total,
      total_ngn: total
    });
    if (orderError) throw new Error("Could not create the order");

    const { error: itemsError } = await client.from("order_items").insert(
      orderItems.map((item) => ({ ...item, order_id: orderId }))
    );
    if (itemsError) {
      await client.from("orders").delete().eq("id", orderId);
      throw new Error("Could not save the order items");
    }

    try {
      const checkoutUrl = await initializeMonnifyTransaction({
        amount: total,
        customerEmail: email,
        customerName: name,
        customerMobileNumber: phone,
        paymentReference,
        orderId
      });
      return Response.json({ orderId, checkoutUrl }, { headers: corsHeaders });
    } catch (error) {
      await client.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
      throw error;
    }
  } catch (error) {
    console.error("Monnify checkout initialization failed", error);
    return fail(error instanceof Error ? error.message : "Could not start checkout", 502);
  }
});
