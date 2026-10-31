# Cossirae Supabase + Monnify Setup

The storefront creates orders and totals on a Supabase Edge Function, redirects customers to Monnify-hosted checkout, and verifies payment server-side. Monnify secrets must never be placed in `assets/js/config.js` or Vercel static files.

## Fix The Owner Invite Redirect

If an invite link opens `localhost`, Supabase is still using the local development URL as its default auth redirect.

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://cossirae.vercel.app`.
3. Add `https://cossirae.vercel.app/**` under **Redirect URLs** and save.
4. Send a fresh invitation from **Authentication → Users → Add user → Send invitation**. The old email may still contain the old localhost redirect.

If `cossirae.ng` is already connected to Vercel, add its matching site and redirect URL too. Supabase uses the Site URL when no valid redirect is provided; an invite redirect not on the allowlist can fall back to that Site URL.

## Database

For a brand-new Supabase project, run `supabase/schema.sql` once in **SQL Editor**.

For an existing project, run these additive migrations separately in SQL Editor:

- `supabase/product-studio-migration.sql`
- `supabase/monnify-payment-migration.sql`

The Monnify migration changes the default payment method and removes public direct order-insert policies. Orders are now created through the server-side checkout function, which recalculates prices and checks stock from the database.

## Monnify Credentials

In the Monnify dashboard, use **test/sandbox** credentials first. You need the API Key, Client Secret, and Contract Code. Store them as Supabase Edge Function secrets, not in the website:

```sh
supabase secrets set MONNIFY_API_KEY=MK_TEST_VALUE
supabase secrets set MONNIFY_CLIENT_SECRET=TEST_CLIENT_SECRET
supabase secrets set MONNIFY_CONTRACT_CODE=CONTRACT_CODE
supabase secrets set MONNIFY_ENVIRONMENT=sandbox
supabase secrets set COSSIRAE_SITE_URL=https://cossirae.vercel.app
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_KEY
```

Keep the Supabase secret/service-role key and Monnify Client Secret private. Do not paste them into chat or commit them to GitHub. `SUPABASE_URL` is provided to Edge Functions by Supabase.

## Deploy Edge Functions

From the repository directory, link the Supabase project if it is not already linked, then deploy:

```sh
supabase functions deploy create-monnify-checkout --no-verify-jwt
supabase functions deploy verify-monnify --no-verify-jwt
supabase functions deploy monnify-webhook --no-verify-jwt
supabase functions deploy send-order-email
supabase functions deploy log-event
```

The checkout function is public for guest checkout, but it reads product prices and stock server-side. Payment status is only marked paid after Monnify verification; the browser callback is not trusted.

## Monnify Webhook

In Monnify, open **Developers → Webhook URLs** and set the Transaction Completion URL to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/monnify-webhook`

The webhook verifies transactions against Monnify. In live mode it also validates Monnify's `monnify-signature` using the Client Secret. Sandbox webhooks do not include that signature, so sandbox transactions are still checked against Monnify's verification API.

## Go Live

After successful sandbox checkout testing:

1. Replace the Supabase Monnify secrets with the live API Key, Client Secret, and Contract Code.
2. Set `MONNIFY_ENVIRONMENT=live`.
3. Confirm `COSSIRAE_SITE_URL` is the deployed production domain.
4. Set the production Transaction Completion webhook URL in Monnify.
5. Test a low-value live transaction and confirm both the customer redirect and order status.

The production checkout URL is generated using server credentials. Neither the Monnify Client Secret nor a Supabase service-role key is exposed to customers.
