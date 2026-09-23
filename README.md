# Cossirae Website

This is a static first version of the Cossirae website, built from the attached visual direction while treating the pasted master prompt as reference only.

## Pages Included

- `index.html` - homepage
- `shop.html` - shop and category listing
- `product.html` - product detail page
- `about.html` - story/about page
- `cart.html` - cart and checkout mockup
- `wishlist.html` - account/wishlist mockup
- `admin.html` - admin dashboard for products, catalogue, media, orders, categories and analytics
- `account.html` - customer sign in/sign up page
- `404.html` - branded not found page
- `product-intake.html` - redirects to the admin dashboard

The Journal page is intentionally left out for now.

## Functionality Included

- Large product search overlay
- Add to bag buttons
- Cart quantity controls
- Browser-based wishlist
- Supabase-ready product/order/form storage
- Paystack-ready checkout flow
- Admin dashboard for catalogue, orders and analytics
- Product image/video fields with local previews
- Supabase Storage-ready product media uploads
- Customer account sign up/sign in
- Paystack webhook function for payment verification
- Email function scaffold for order notifications
- Logging function and app log table
- Admin monitoring tab for recent system logs
- Cache header configs for Netlify/Vercel/static hosts
- Browser-based demo fallback when keys are not configured
- Newsletter form confirmation
- Product intake form saved in browser storage
- SEO titles, descriptions, canonical links and Open Graph tags
- Product and organization structured data
- `robots.txt`
- `sitemap.xml`
- SVG favicon
- Mobile navigation

This is still a static front-end build, but it now has a Supabase + Paystack integration path. Cart and wishlist stay in the visitor's browser. Products, orders, product submissions and newsletter subscribers can save to Supabase after you add your keys.

See `SUPABASE_PAYSTACK_SETUP.md` for the database and payment setup.

## Admin Dashboard

Open `admin.html` to manage:

- Products
- Images and videos
- Descriptions, sizes, colours, prices and stock
- Categories
- Catalogue table
- Orders
- Revenue and product analytics

Without Supabase keys, admin changes are saved in the browser and immediately affect the local shop page in that same browser. With Supabase configured and an admin user signed in, products and categories can be saved to the database.

For live admin access, create a Supabase Auth user and add their user id to `public.admin_roles`.

## Production Hardening Added

- 404 page at `404.html`
- Customer account page at `account.html`
- Admin role table and `is_admin()` database helper
- Customer-owned order policies
- Admin-only product/category/order policies
- Supabase Storage bucket and media policies for `product-media`
- Paystack webhook function with signature verification
- Order email function scaffold using Resend
- Browser and webhook logging into `app_logs`
- Cache headers for static assets and HTML
- Product slug URLs through `product.html?slug=...` and deployment rewrites for `/products/:slug`

## Replace The Pictures

Put final images inside `assets/images/`. Recommended filenames are listed in `assets/images/README.md`.

For example, add:

- `assets/images/hero-home.jpg`
- `assets/images/category-dresses.jpg`
- `assets/images/product-abeni-1.jpg`

The pages already point to these filenames, so once the images are added they will appear automatically.

## Shop By Category

The current categories are:

- Dresses
- Kaftans
- New In
- Accessories

There is no Men category because Cossirae is positioned here as a women's fashion brand.

## Product Management

Use `admin.html` for product management. The old `product-intake.html` now redirects there.

The admin dashboard lets staff add and edit products, categories, images, videos, descriptions, sizes, colours, stock, prices, orders and analytics. Use `forms/cossirae-product-template.csv` only if you still want an offline spreadsheet backup.

Before launch, remove public footer links to `admin.html` if you do not want customers to see the admin entry point. The page is marked `noindex`, and real access control should be handled with Supabase Authentication.

## Publish To cossirae.ng

Option 1: upload the files to your web host.

1. Zip the full folder contents.
2. Upload everything to the `public_html` folder for `cossirae.ng`.
3. Make sure `index.html` is at the top level of `public_html`.
4. Visit `https://cossirae.ng`.

Option 2: use Netlify or Vercel.

1. Push this folder to GitHub.
2. Import the repo into Netlify or Vercel.
3. Set the domain to `cossirae.ng`.
4. Update your domain DNS records to point to the selected host.

For real payments, inventory, orders and customer accounts, the next step should be rebuilding this visual design in Shopify, WooCommerce, or a custom commerce backend.

## SEO Checklist Before Launch

- Replace all placeholder images with final photos.
- Update social links in the footer.
- Add a real logo image if needed.
- Replace demo product information with real inventory.
- Submit `https://cossirae.ng/sitemap.xml` to Google Search Console.
- Connect analytics and conversion tracking.
