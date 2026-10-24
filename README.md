# SUPER MARKET

A mobile-first React/Vite storefront with a Django REST API for an Indian supermarket. It includes product browsing, customer JWT authentication, a local cart, COD checkout, order history, a role-protected administration workspace, and a referral wallet-credit workflow.

## Storefront design direction

The visual direction is an original green-and-white grocery shopping experience: mobile-first navigation, clear aisles and search, responsive product cards, quick add-to-bag actions, and a separate role-aware administration workspace. These sources inform general e-commerce and grocery usability; the implementation uses original components, copy, and styling:

- [Shopify store examples](https://www.shopify.com/in/examples)
- [Simicart grocery app design](https://simicart.com/templates/grocery-app-design/)
- [Baymard online grocery UX guidance](https://baymard.com/audits/online-grocery)

## Requirements

- Node.js 20+ and npm
- Python 3.12+ (Python 3.14 was available during implementation)
- MySQL 8+ for a shared/production-like database (SQLite is the development default)

## Run locally on Windows

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
py manage.py migrate
py manage.py createsuperuser
py manage.py runserver
```

For MySQL, create a database and user, then set `DB_ENGINE=mysql`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` in `backend/.env`. Install the MySQL development client required by `mysqlclient` on Windows before installing requirements. Leave `DB_ENGINE=sqlite` for a zero-setup development database.

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL (normally http://localhost:5173). The API defaults to http://localhost:8000/api/v1.

## Useful commands

- `py manage.py test` — backend tests
- `npm run build` — production frontend build
- `py manage.py createsuperuser` — create the first administrator securely; no administrator credentials are seeded

OpenAPI documentation is available at `/api/schema/swagger-ui/` after starting Django.

## Deploy on Vercel

The repository root `vercel.json` configures a `frontend` Vite service and a
`backend` Django service. The backend receives public `/api/*` requests; all
other paths route to the frontend, which serves the React application and its
client-side routes. The frontend uses same-origin `/api/v1` requests in
production, so no build-time backend URL or service binding is needed.

Before deploying, configure these environment variables in the Vercel project:

- `DJANGO_SECRET_KEY`: a unique, strong production secret.
- `DJANGO_DEBUG=False`.
- `DJANGO_ALLOWED_HOSTS`: comma-separated custom domains, if any. Vercel's
  `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` hosts are included
  automatically.
- `DB_ENGINE=mysql`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and
  `DB_PORT`: credentials for a persistent MySQL service reachable from Vercel
  Functions.

Do not use the default SQLite database for deployed data: Vercel function
storage is not persistent. Run database migrations against the configured
deployment database as a separate deployment operation; they are not run
automatically during builds. With Vercel CLI 50.38.0 or newer, `vercel dev`
runs both services locally.

## Implemented API

- `POST /api/v1/auth/register/`, `/auth/login/`, `/auth/refresh/`, `/auth/logout/`, `/auth/me/`
- `GET /api/v1/categories/`, `/products/`, `/products/{id}/`
- `POST /api/v1/orders/`, `GET /api/v1/orders/`, `/orders/{id}/`
- `GET /api/v1/referrals/me/`, `/referrals/me/rewards/`, `/referrals/me/wallet/`; `POST /api/v1/referrals/validate/`
- `GET /api/v1/system-settings/public/` for Pandiyan Store contact and delivery details
- `/api/v1/admin/dashboard/`, `/admin/products/`, `/admin/categories/`, `/admin/orders/`
- Referral administration under `/api/v1/admin/`: `/referrals/`, `/referrals/stats/`, `/referrals/network/`, `/referrals/network/{customer_id}/`, `/referrals/wallet-adjustments/`, `/rewards/`, and `/referral-settings/`
- Authenticated customer services under `/api/v1/account/`: addresses, wishlist, questions, requests, support tickets, returns, rewards, reseller applications and payouts
- Public published content at `/api/v1/blogs/`, `/api/v1/blog-categories/`, and `/api/v1/store-information/`
- Administrator services under `/api/v1/admin/`: customer questions/requests, support tickets, returns, blog posts/categories, reseller applications/commissions/payouts, commission rules, store information and referral reward overview

The Account page links to orders, referral rewards, questions, saved addresses, customer requests, published blogs, wishlist, support, the reseller programme, and configured store information. Authorized staff also receive an Admin dashboard link. The administration workspace is separate from the storefront and presents tools according to staff role. Customer endpoints scope records to the authenticated user; administrative APIs require an active staff account and enforce role/module permissions.

## Store policy pages

The storefront provides `/terms-and-conditions`, `/privacy-policy`, `/delivery-policy`, `/return-refund-policy`, and `/ugc-policy`. Policy links open a compact, scrollable dialog with a close button; the routes remain directly accessible and refreshable. Policy prose is managed in the existing admin store-information JSON (`terms`, `privacy_policy`, `return_policy`, and `ugc_policy`); authorized Senior Admins and managers explicitly granted the `blogs` module can edit it. Saving publishes immediately. The existing store-information model has no policy-specific approval status or revision history. Delivery charges, PIN codes, minimum order, operating hours, and estimated delivery timeline are read from authorized system settings; the default 6–24 hour estimate is subject to actual operations.

The policy pages are marked as drafts until owner/legal review. The owner-supplied Terms, Privacy and Refund text is included in the page drafts, with implementation-dependent privacy and payment statements qualified to match the current site. The proposed broad UGC licence is displayed as inactive pending approval. Before considering the text final, the owner must resolve the 14-day versus 30-day general return period, the start of the 24-hour perishable and 48-hour damaged-item periods, UGC licence scope/duration, dispute jurisdiction and liability wording, privacy/deletion/tracking claims, and COD refund method/timing. No legal approval or compliance claim is implied.

## Current limits

SQLite is the default for local convenience; MySQL is configured as an option and should be used for deployment. Orders are COD only. Checkout requires a supported PIN and ₹300 merchandise subtotal; it charges ₹30 through a ₹1,000 subtotal inclusive and is free only above ₹1,000. Prices, discounts, delivery availability and stock are recalculated by the server. Referral qualification is cumulative net spending from a user's own delivered orders; referral purchases do not count toward that user's threshold. Referral rewards use immutable wallet ledger entries, idempotent credits, and configurable percentage rules capped at five levels. Commissions are awarded only after delivery and reversed for cancellations, completed returns and full refunds. Managers receive only Senior Admin-assigned API module grants; referral settings and wallet adjustments remain Senior Admin-only. The wallet spending and expiry settings are stored for future use; checkout redemption and expiry enforcement are not implemented. Ineligible reward attempts are not retained as durable records. Saved addresses, customer questions/requests/support, wishlist, returns, blogs, store information, coupons and reseller applications/commission/payout records are implemented. Payouts are review-and-record only; there is no payment transfer integration. Returns are requested for delivered orders and require administrator handling; customer refund transfers are not integrated. Blog content is stored and rendered as plain text; rich-text HTML is intentionally not rendered. Demo products, stock and featured/bestseller labels are sample data, not real business metrics.

## Catalogue visibility and referral commission basis

Customer catalogue APIs expose only active products with positive stock in active categories; checkout rechecks those flags and locks product rows while validating and decrementing stock. Administrators can still manage inactive and out-of-stock inventory. Product cards, details, cart, and checkout show the selling price and, when available, the MRP and savings; cart and checkout refresh product status and prices before proceeding. Referral rates can apply across all categories or only to selected categories, with a configurable maximum depth of one to five levels. Category reward eligibility can be explicitly enabled or disabled, or inherited from the global referral setting; category-specific rates override global rates only when the explicit override option is enabled. Commissions remain percentages of net merchandise value (subtotal less order discount). When category rates differ, the order-level discount is allocated proportionally to item line totals in cents, with rounding remainder assigned deterministically to the final line item. Confirm this proportional discount allocation as the business policy before relying on category-specific commissions for accounting.

This foundation has not undergone a dedicated security review and should not be described as production-secure without one.
