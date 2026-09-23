# Deploy Cossirae To Vercel

This project is ready to host on Vercel as a static site.

## Recommended: Deploy With GitHub

1. Create a GitHub repository for this folder.
2. Push the project to GitHub.
3. Go to Vercel and choose **Add New Project**.
4. Import the GitHub repository.
5. Use these settings:
   - Framework Preset: **Other**
   - Build Command: leave empty
   - Output Directory: leave empty
   - Install Command: leave empty
6. Click **Deploy**.

Vercel will serve `index.html` from the project root.

## Deploy With Vercel CLI

If you prefer CLI:

```bash
npm i -g vercel
vercel login
cd /Users/work/Documents/ChatGPT/COSSIRAE
vercel
```

For production:

```bash
vercel --prod
```

## Domain Setup

After deployment:

1. Open the project in Vercel.
2. Go to **Settings → Domains**.
3. Add `cossirae.ng`.
4. Follow Vercel's DNS instructions.
5. Add both:
   - `cossirae.ng`
   - `www.cossirae.ng`

## Environment And Backend Notes

The frontend can go live on Vercel now, but real commerce needs:

- Supabase project URL and anon key in `assets/js/config.js`
- Paystack public key in `assets/js/config.js`
- Supabase SQL schema installed
- Supabase Edge Functions deployed
- Paystack webhook URL configured
- Resend/email secrets added to Supabase

Do not put Paystack secret keys or Supabase service-role keys in frontend files.

## Vercel Config Included

`vercel.json` already includes:

- long cache for `/assets/*`
- short revalidation for HTML
- sitemap and robots caching
- `/products/:slug` rewrite to `product.html?slug=:slug`
- redirect from old `product-intake.html` to `admin.html`

## After Deploying

Test:

- `/`
- `/shop.html`
- `/product.html?slug=abeni-maxi-dress`
- `/products/abeni-maxi-dress`
- `/cart.html`
- `/account.html`
- `/admin.html`
- `/404.html`
