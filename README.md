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
py manage.py seed_demo
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
- `py manage.py seed_demo` — idempotently create clearly identified sample categories and products
- `npm run build` — production frontend build
- `py manage.py createsuperuser` — create the first administrator securely; no administrator credentials are seeded

OpenAPI documentation is available at `/api/schema/swagger-ui/` after starting Django.

## Implemented API

- `POST /api/v1/auth/register/`, `/auth/login/`, `/auth/refresh/`, `/auth/logout/`, `/auth/me/`
- `GET /api/v1/categories/`, `/products/`, `/products/{id}/`
- `POST /api/v1/orders/`, `GET /api/v1/orders/`, `/orders/{id}/`
- `GET /api/v1/referrals/me/`, `/referrals/me/rewards/`, `/referrals/me/wallet/`; `POST /api/v1/referrals/validate/`
- `/api/v1/admin/dashboard/`, `/admin/products/`, `/admin/categories/`, `/admin/orders/`
- Referral administration under `/api/v1/admin/`: `/referrals/`, `/referrals/stats/`, `/referrals/network/`, `/referrals/network/{customer_id}/`, `/referrals/wallet-adjustments/`, `/rewards/`, and `/referral-settings/`
- Authenticated customer services under `/api/v1/account/`: addresses, wishlist, questions, requests, support tickets, returns, rewards, reseller applications and payouts
- Public published content at `/api/v1/blogs/`, `/api/v1/blog-categories/`, and `/api/v1/store-information/`
- Administrator services under `/api/v1/admin/`: customer questions/requests, support tickets, returns, blog posts/categories, reseller applications/commissions/payouts, commission rules, store information and referral reward overview

The Account page links to orders, referral rewards, questions, saved addresses, customer requests, published blogs, wishlist, support, the reseller programme, and configured store information. Authorized staff also receive an Admin dashboard link. The administration workspace is separate from the storefront and presents tools according to staff role. Customer endpoints scope records to the authenticated user; administrative APIs require an active staff account and enforce role/module permissions.

## Current limits

SQLite is the default for local convenience; MySQL is configured as an option and should be used for deployment. Orders are COD only. The cart is persisted in the browser, with prices and stock recalculated by the server at order creation. Referral rewards use immutable wallet ledger entries, configurable level rules, and idempotent credits after a qualifying order. Full refunds and configured cancellations can reverse credited rewards. The wallet spending and expiry settings are stored for future use; checkout redemption and expiry enforcement are not implemented. Refund reversal is full-only, and ineligible reward attempts are not retained as durable records. Saved addresses, customer questions/requests/support, wishlist, returns, blogs, store information and reseller applications/commission/payout records are implemented. Payouts are review-and-record only; there is no payment transfer integration. The project has no coupon model, so coupon creation/redemption is not available. Returns are requested for delivered orders and require administrator handling; a refund/payment reversal integration is not present. Blog content is stored and rendered as plain text; rich-text HTML is intentionally not rendered. Demo products, stock and featured/bestseller labels are sample data, not real business metrics.

This foundation has not undergone a dedicated security review and should not be described as production-secure without one.
