# Metric Labs | Shopify Tools Hub

Frontend-only Shopify tools showcase for **Metric Labs**.

Users browse products and request purchases via WhatsApp (no online checkout). Admins manage products directly from the frontend using Firebase (Firestore/Auth/Storage).

## Features

- Responsive product grid with modern card UI
- Product search and tag filtering
- WhatsApp "Buy Now" links with prefilled product message
- Floating WhatsApp support button
- Light/Dark mode toggle
- Onboarding walkthrough modal
- Toast notifications for actions
- Admin panel (role-based) for:
  - Add/Edit/Delete products
  - Toggle product visibility
  - Reorder products
  - Upload multiple product images
  - Preview product card + WhatsApp message before publish

## Tech Stack

- React + Vite
- Tailwind CSS
- Framer Motion
- Firebase Auth
- Firebase Firestore
- Firebase Storage

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional but recommended)

### 3) Run locally

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
npm run preview
```

## Firebase Collections

### `products`

Each product document should include fields like:

- `name` (string)
- `description` (string)
- `price` (string)
- `images` (string[])
- `visible` (boolean)
- `tags` (string[])
- `order` (number)

### `admin_users`

Use the authenticated Firebase user UID as document ID, with:

- `role: "admin"`

Only users with role `admin` can access admin management UI.

## WhatsApp Purchase Flow

Buy links are generated as:

`https://wa.me/18255950642?text=I%20want%20to%20buy%20{{product_name}}`

## Footer Disclaimer

Users are responsible for complying with applicable laws. Metric Labs is not liable for misuse of Shopify tools requested via WhatsApp.
