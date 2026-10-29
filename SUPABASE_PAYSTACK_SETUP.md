# Cossirae Supabase + Paystack Setup

This project is now ready for Supabase and Paystack. It still works locally without keys, but live checkout and database saving start when the credentials are added.

## 1. Create Supabase Project

1. Go to Supabase and create a new project.
2. Open the SQL editor.
3. Paste and run `supabase/schema.sql`.
4. Confirm these tables exist:
   - `products`
   - `customers`
   - `orders`
   - `order_items`
   - `product_submissions`
   - `newsletter_subscribers`

The schema already includes starter Cossirae products and Row Level Security policies.

The admin dashboard is `admin.html`. Create an admin user in Supabase Authentication, sign in from the admin page, then manage products and categories there.

The Product Editor supports multiple compressed photos, product videos, garment type, set contents, sizes, colours, lengths, fit, fabric, care instructions and custom specifications. It includes a live product-card preview. To share product entry with the owner, configure Supabase, create their Auth user, grant that user an `admin_roles` row, and send them the deployed `/admin.html` URL. The editor must show the cloud-catalogue notice before products/media will sync across devices. Without Supabase configuration it is a browser-only demo.

If the Supabase project was created before these product fields were added, rerun `supabase/schema.sql` in its SQL Editor to add the new columns before saving products from Product Studio.

## 1b. Make A User An Admin

After creating an admin user in Supabase Authentication, copy their user id and run:

```sql
insert into public.admin_roles (user_id, role)
values ('USER_ID_HERE', 'owner')
on conflict (user_id) do update set role = excluded.role;
```

Only users in `admin_roles` can manage products, categories, orders and product media.

## 2. Add Browser Keys

Open `assets/js/config.js` and replace:

```js
window.COSSIRAE_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_PROJECT_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  paystackPublicKey: "YOUR_PAYSTACK_PUBLIC_KEY",
  supabaseStorageBucket: "product-media",
  currency: "NGN"
};
```

Use only the Supabase anon/publishable key in the browser. Never put the Supabase service role key or Paystack secret key in `assets/js/config.js`.

## 2b. Media Storage

The schema creates a public Supabase Storage bucket named `product-media`.

Admin uploads are compressed in the browser, uploaded to this bucket, and saved as public URLs when:

- Supabase keys are configured
- the admin is signed in
- the signed-in user exists in `public.admin_roles`

Without that setup, media remains in local browser demo storage.

## 3. Create Paystack Account

1. Create or open your Paystack business account.
2. Copy the public key into `assets/js/config.js`.
3. Keep the secret key for the Supabase Edge Function only.

## 4. Deploy Payment Verification Function

Deploy the secure functions:

```bash
supabase functions deploy verify-paystack
supabase functions deploy paystack-webhook
supabase functions deploy send-order-email
supabase functions deploy log-event
```

Set secrets:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_or_live_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set ORDER_EMAIL_FROM="Cossirae <orders@cossirae.ng>"
supabase secrets set ORDER_ADMIN_EMAIL=orders@cossirae.ng
```

`SUPABASE_URL` is normally available inside Supabase Edge Functions. If your project requires it explicitly:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
```

## 4b. Paystack Webhook

In Paystack, set the webhook URL to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`

The webhook verifies `x-paystack-signature`, updates paid orders, logs the event and triggers order emails.

## 4c. Monitoring

Browser errors, Paystack webhook events and function events are written to `public.app_logs` through the `log-event` Edge Function or service-role functions. Admins can view recent logs in the Monitoring tab of `admin.html`.

## 4d. Caching And 404

This repo includes:

- `_headers` for Netlify-style static headers
- `netlify.toml`
- `vercel.json`
- `404.html`

Assets use long-lived immutable caching. HTML uses revalidation so new product/admin updates do not get stuck behind stale pages.

## 5. Current Flow

1. Customer adds products to cart.
2. Customer fills checkout form.
3. Site creates a pending order in Supabase.
4. Paystack popup opens.
5. After payment success, the site calls the Supabase Edge Function.
6. Edge Function verifies the Paystack reference using the secret key.
7. Order payment status updates to `paid` or `failed`.

If Paystack redirects or the browser closes, the webhook is the backup verification path.

## 6. What Still Needs Production Polish

- Connect a verified email domain for Resend/order emails
- Delivery/shipping fee rules
- Fine-grained admin UI for order fulfilment
- Product pages with server-rendered metadata if you move beyond static hosting

The current setup is a strong start for free-tier Supabase + Paystack, then you can upgrade when sales volume grows.
