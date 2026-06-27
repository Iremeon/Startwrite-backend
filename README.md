# Startwrite Backend

**Startwrite** is a prepaid, credit-based marketplace for business document templates. Individuals and organizations register, receive a starting wallet balance, and spend it downloading templates priced by class (A/B/C). There are no subscriptions and no free templates — every download draws from the account's wallet balance, which is topped up via Stripe.

This repository is the backend REST API only — Express + PostgreSQL (Prisma) + Redis + Stripe + Cloudinary + SendGrid, all written in TypeScript.

---

## Table of Contents

1. [Business Model](#business-model)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database Schema Overview](#database-schema-overview)
7. [API Surface](#api-surface)
8. [Authentication](#authentication)
9. [The Wallet System](#the-wallet-system)
10. [Admin Operations](#admin-operations)
11. [Scripts Reference](#scripts-reference)
12. [Running With Docker](#running-with-docker)
13. [Project Structure](#project-structure)
14. [Coding Conventions](#coding-conventions)
15. [Known Gaps / Next Steps](#known-gaps--next-steps)

---

## Business Model

There is **no free tier and no subscription billing**. The platform works on a prepaid credit model:

| Concept | Rule |
|---|---|
| Registration | One unified flow for both individuals and organizations |
| Account type | Determined by whether a `tinNumber` is provided at registration |
| Organizations | Provide a 9-digit Rwanda RRA-format TIN — **skip email verification** (trusted via the TIN) |
| Individuals | No TIN — **must verify their email** before they can log in |
| Starting balance | Every new account starts with **$3.00** in wallet balance, freely spendable on any template, any class, any combination |
| Template pricing | Every template belongs to a class with a fixed current price: **Class A = $3, Class B = $2, Class C = $1** (admin-adjustable, see [Wallet System](#the-wallet-system)) |
| Downloads | Each download atomically deducts the template's class price from the account's wallet balance and logs a ledger entry |
| Insufficient balance | Download is blocked (`402 INSUFFICIENT_BALANCE`) until the account tops up |
| Top-ups | Fixed packages only (e.g. $5 / $10 / $20), paid via a **one-time** Stripe Checkout session — no recurring billing of any kind |

There is no "premium" flag, no subscription period, and no template is ever free outside of spending the starting $3 balance.

---

## Tech Stack

- **Runtime / Framework:** Node.js + Express, written in TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Cache / Token store:** Redis — used for email verification tokens and revocable refresh tokens
- **Auth:** JWT (access + refresh) + Google OAuth (Google Identity Services / ID token flow), local and Google logins linked by email into one account
- **Payments:** Stripe, **one-time payment mode only** (no Stripe Billing / subscriptions)
- **File storage:** Cloudinary — only the resulting URL is ever stored in the database, never the file itself
- **Email:** SendGrid, triggered via an internal event emitter (`src/utils/events.ts`) so email-sending is decoupled from business logic
- **Validation:** Joi
- **API Docs:** Swagger / OpenAPI (`swagger-jsdoc` + `swagger-ui-express`), served at `/api/docs`
- **Linting/Formatting:** ESLint + Prettier
- **Containerization:** Docker + Docker Compose (Postgres + Redis + API)

---

## Architecture

```
Client (web/mobile, admin dashboard)
        │  HTTPS / REST (JSON, multipart for uploads)
        ▼
Express API Layer
  - Routes → Controllers → Services (controllers stay thin; business logic lives in services)
  - Middleware: JWT auth, role checks, Joi validation, rate limiting
  - Swagger docs generated from JSDoc blocks above each route
        │
   ┌────┼────────────┬───────────────┐
   ▼    ▼            ▼               ▼
PostgreSQL  Redis   Cloudinary     Stripe
(Prisma)   (tokens) (files)    (one-time payments)
```

**Key design decisions:**

- **Wallet balance, not subscription state.** `User.walletBalance` is a single decimal field. The Stripe webhook is the *only* code path allowed to increase it (top-up); the template download service is the only path allowed to decrease it. Both run inside a Prisma `$transaction`, alongside a `WalletTransaction` ledger entry, so balance and history can never drift apart.
- **Pricing lives on a class, not a template.** `PricingTier` holds the current price for each of the three classes (A/B/C). Templates only store which class they belong to. Changing a class's price instantly applies to every template in that class — no migration, no per-row updates.
- **One registration endpoint, two behaviors.** There's no separate "Organization" model — `User` represents either, distinguished entirely by whether `tinNumber` is set. This keeps auth mechanics (JWT, refresh, password reset) identical regardless of account type.
- **Merged upload + create for templates.** Admin sends the file and its metadata in a single `multipart/form-data` request to `POST /admin/templates` — no separate upload-then-create round trip.
- **Stripe webhook receives the raw body.** Mounted in `app.ts` *before* the global JSON body parser, since Stripe's signature verification requires the unparsed request body.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, JWT secrets, SENDGRID_API_KEY,
# GOOGLE_CLIENT_ID/SECRET, CLOUDINARY_*, STRIPE_*, ADMIN_*

# 3. Generate the Prisma client and run migrations
npm run generate
npm run migrate

# 4. Seed the database (admin user, pricing tiers, wallet packages, categories, sample templates)
npm run seed

# 5. Start the dev server
npm run dev
```

The API runs at `http://localhost:5000` (or whatever `PORT` is set to), Swagger docs at `http://localhost:5000/api/docs`, health check at `http://localhost:5000/health`.



---

## Environment Variables

See `.env.example` for the full list with placeholder values. Notable groups:

- **App:** `PORT`, `API_PREFIX`, `NODE_ENV`
- **Database/Redis:** `DATABASE_URL`, `REDIS_URL`
- **JWT:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and their expiry windows
- **Email verification:** TTLs for verification/reset tokens (stored in Redis)
- **SendGrid:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `FRONTEND_URL` (used to build links inside emails)
- **Google OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (one-time payment mode only)
- **Seed admin:** `ADMIN_FULL_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`


---

## Database Schema Overview

| Model | Purpose |
|---|---|
| `User` | Individual or organization account. `tinNumber` presence distinguishes them. Holds `walletBalance`. |
| `UserOAuthAccount` | Links a Google identity to a `User`, supports adding more providers later |
| `Category` / `Subcategory` | Pure organizational hierarchy for browsing — no pricing, no files |
| `Template` | The actual downloadable document. Belongs to a `Subcategory` and a `TemplateClass` (A/B/C). Stores the Cloudinary `fileUrl`. |
| `PricingTier` | Current price per class — one row each for A, B, C |
| `WalletPackage` | Fixed top-up amounts offered at checkout (e.g. $5/$10/$20) |
| `WalletTransaction` | Full audit ledger — every top-up and every download deduction, with a `balanceAfter` snapshot |

```
Category ──< Subcategory ──< Template (templateClass: A | B | C)
                                   │
                                   ▼ (price looked up at download time)
                              PricingTier

User ──< WalletTransaction >── Template (nullable — only set for downloads)
User ──< UserOAuthAccount
```

---

## API Surface

All endpoints are prefixed with `/api/v1` (configurable via `API_PREFIX`). Full request/response schemas are in Swagger at `/api/docs`; this is the high-level map.

| Module | Endpoints |
|---|---|
| **Auth** | `POST /auth/register`, `/login`, `/google/token`, `/refresh`, `/logout`, `/verify-email`, `/forgot-password`, `/verify-reset-token`, `/reset-password` |
| **Users** | `GET /users/me` |
| **Categories** | `GET /categories`, `GET /categories/:slug`; admin: `POST/PATCH/DELETE /admin/categories`, subcategory equivalents |
| **Templates** | `GET /templates`, `GET /templates/:slug`, `GET /templates/:id/download` (the wallet-gated endpoint); admin: `POST /admin/templates` (merged upload+create), `PATCH/DELETE /admin/templates/:id` |
| **Wallet** | `GET /wallet/packages`, `GET /wallet/me`, `POST /wallet/topup`, `POST /wallet/webhook` (Stripe) |
| **Admin** | `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/dashboard/stats` |

---

## Authentication

- **Local registration:** `name`, `email`, `password`, optional `phoneNumber`, optional `tinNumber`.
  - `tinNumber` provided → organization → `isEmailVerified: true` immediately, no email sent.
  - `tinNumber` omitted → individual → verification email sent via SendGrid; login is **hard-blocked** (`403 EMAIL_NOT_VERIFIED`) until the link is used.
- **Google OAuth:** frontend obtains a Google ID token (popup/SPA flow) and posts it to `/auth/google/token`. The backend verifies it against `GOOGLE_CLIENT_ID`, finds-or-creates the user by email, and **auto-verifies** (Google already confirmed the email). If a local account with the same email already exists, the Google identity is linked to it rather than creating a duplicate account.
- **Tokens:** short-lived JWT access token (15 min default) + a longer-lived refresh token stored in Redis, revocable on logout, rotated on every refresh.
- **Password reset is a 3-step flow:** request → verify-token (non-destructive check) → reset (consumes the token). This lets a frontend show "link expired" before the user types a new password.

---

## The Wallet System

This is the core business logic of the application.

**Starting balance:** every new account (individual or organization) is created with `walletBalance = 3.00`. There is no separate "free tier" mechanism — it's simply real wallet money, spendable on anything.

**Pricing:** `PricingTier` holds one row per class:

| Class | Default Price |
|---|---|
| A | $3.00 |
| B | $2.00 |
| C | $1.00 |

These are seed defaults and intentionally adjustable by admins later (a price update endpoint can be added on top of `PricingTier` without touching any `Template` row).

**Download flow (`GET /templates/:id/download`):**
1. Authenticate the caller (`authMiddleware`).
2. Look up the template's class and the current price for that class.
3. Look up the caller's current `walletBalance`.
4. If `balance < price` → `402 INSUFFICIENT_BALANCE`, with the exact shortfall in the response.
5. Otherwise, in a single Prisma `$transaction`: decrement the balance, increment the template's `downloadCount`, write a `WalletTransaction` (`DOWNLOAD_DEDUCTION`) — then return the file URL.

**Top-up flow (`POST /wallet/topup`):**
1. Caller picks a `packageId` (one of the fixed amounts in `WalletPackage`).
2. Backend creates a Stripe Checkout Session in **`mode: 'payment'`** (one-time, not subscription) using inline `price_data` — no pre-created Stripe Price object is needed for fixed packages.
3. User pays on Stripe's hosted page.
4. Stripe calls `POST /wallet/webhook` with `checkout.session.completed`. The webhook handler is the **only** code path allowed to increase `walletBalance` — it credits the account and writes a `WalletTransaction` (`TOP_UP`) inside a `$transaction`, then fires a confirmation email.

**Why no Stripe subscriptions:** there is no recurring billing concept in this product at all — no plans, no renewal, no cancellation lifecycle. Every payment is a one-time top-up; the wallet balance itself has no expiry.

---

## Admin Operations

- **Categories/Subcategories:** standard CRUD, soft-delete via `isActive`.
- **Templates:** `POST /admin/templates` is a single `multipart/form-data` request — admin attaches the file (and optional preview image) **and** the metadata (`title`, `slug`, `templateClass`, etc.) together. The backend streams the file to Cloudinary and creates the database row in the same request — no separate upload-then-create round trip.
- **Users:** list/filter, activate/deactivate (`isActive: false` blocks login with `403 ACCOUNT_DISABLED`).
- **Dashboard stats:** total users (split by organization vs. individual via TIN presence), total templates, total downloads, total revenue (sum of all `TOP_UP` transactions), total outstanding wallet balance across all accounts, and the 5 most-downloaded templates.

---

## Scripts Reference

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server with nodemon + ts-node |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run migrate` | Run Prisma migrations (dev) |
| `npm run migrate:deploy` | Apply migrations in production |
| `npm run seed` | Seed admin user, pricing tiers, wallet packages, categories, sample templates |
| `npm run studio` | Open Prisma Studio (DB GUI) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Run Jest tests |
| `npm run docker:up` / `docker:down` / `docker:logs` / `docker:seed` | Docker Compose workflow |

---



## Project Structure

```
src/
├── config/         # Prisma client, Redis, Cloudinary, Stripe, Google OAuth, Swagger
├── interfaces/      # Shared TypeScript interfaces (I-prefix for inputs, Dto-suffix for outputs)
├── middlewares/      # JWT auth, role checks, Joi validation, rate limiters, central error handler
├── modules/
│   ├── auth/         # Registration, login, Google OAuth, tokens, password reset
│   ├── users/         # GET /users/me
│   ├── categories/    # Categories + subcategories (public read, admin write)
│   ├── templates/      # Catalog, the wallet-gated download endpoint, merged admin upload+create
│   ├── wallet/          # Packages, balance/history, Stripe top-up checkout + webhook
│   └── admin/            # User management, dashboard stats
├── utils/             # Response formatting, JWT/password helpers, pagination, Cloudinary upload,
│                       # SendGrid mailer, the internal domain-event emitter, ApiError
├── app.ts             # Express app wiring — middleware order matters (see Stripe webhook note above)
└── server.ts          # Entry point — env loading, server start, graceful shutdown
prisma/
├── schema.prisma       # Full data model
└── seed.ts              # Seeds admin, pricing tiers, wallet packages, categories, sample templates
```

Each module follows the same internal layout: `*.routes.ts` → `*.controller.ts` → `*.service.ts` (+ `*.validation.ts` for Joi schemas). Controllers stay thin — they parse the request and format the response; all business logic lives in services.

---

## Coding Conventions

- **Response shape:** every endpoint responds via the shared `ResponseService` — `{ success, message, data }`, with list endpoints additionally returning `meta` (pagination).
- **Errors:** thrown as `ApiError(status, code, message, details?)` from anywhere in a service; the central `errorHandler` middleware formats them consistently. Malformed JSON bodies are caught and returned as a clean `400`, not a `500`.
- **Validation:** every request body/query is validated with Joi via `ValidationMiddleware` before it reaches a controller.
- **No business logic in controllers.** Controllers call a service function and shape the response — nothing else.
- **Money is decimal, never float-math directly in JS without rounding.** Wallet balance operations round to 2 decimal places explicitly before writing.
- **The Stripe webhook and the download-deduction path are the only two places allowed to mutate `walletBalance`** — both do so inside a Prisma `$transaction` alongside a `WalletTransaction` ledger write. Never update the balance anywhere else.

---

## Known Gaps / Next Steps

- **No automated tests yet.** `jest` is configured but no test files exist. Highest priority: the wallet deduction transaction and the Stripe webhook handler — these are the actual money path.
- **No live TIN verification.** `tinNumber` is validated for *format* only (9 digits, matching Rwanda RRA's structure) — there's no integration with RRA's actual verification service.
- **No structured logger.** `winston` is a dependency but unused; everything currently goes through `console.log`/`console.error`.
- **CORS is wide-open** (`cors()` with no config) — restrict to the real frontend origin(s) before any production deployment.
- **Pricing tiers and wallet packages have no admin-facing update endpoints yet** — they're seeded directly. Adding `PATCH /admin/pricing-tiers/:class` and `POST/PATCH /admin/wallet-packages` would be a natural next addition.
