# Stripe Listener

This app runs the Stripe CLI listener for local development.

## Usage

Run the development command to start listening for Stripe webhooks:

```bash
pnpm dev
```

This will execute `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook` to forward Stripe webhook events to your Next.js app's webhook endpoint.

## Prerequisites

- Stripe CLI must be installed and configured
- You must be logged in to Stripe CLI (`stripe login`)
- Your Next.js app should be running on localhost:3000
