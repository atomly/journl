# LocalTunnel Webhook Proxy

This proxy server handles webhooks from Supabase and signs them with HMAC-SHA256 before forwarding to the Next.js application, mimicking Supabase's production webhook behavior.

## Configuration

Set up the following environment variables:

```bash
# Required: Webhook secret (must match the one used in the Next.js app)
SUPABASE_SECRET=your-super-secret-webhook-key-here

# Optional: Next.js app URL (defaults to http://localhost:3000)
NEXT_JS_URL=http://localhost:3000

# Required: LocalTunnel configuration
LOCALTUNNEL_PORT=3001
LOCALTUNNEL_SUBDOMAIN=your-subdomain
```

## How it works

1. **Webhook Reception**: The proxy receives webhook payloads from Supabase
2. **Signature Generation**: Creates an HMAC-SHA256 signature using the webhook secret
3. **Header Addition**: Adds the signature to the `x-supabase-signature` header
4. **Request Forwarding**: Forwards the signed request to the Next.js app using the incoming request URL as is.

## Security

The webhook signature is validated using the same secret key in both the proxy and the Next.js app. This ensures that:

- Only legitimate webhooks are processed
- The payload hasn't been tampered with
- Timing attacks are prevented using `crypto.timingSafeEqual`

## Usage

1. Set the environment variables
2. Start your Next.js app (`pnpm dev` in the web app)
3. Start the proxy server
4. Configure your Supabase webhook to point to the localtunnel URL

The proxy will automatically sign all incoming webhooks and forward them to your Next.js application for processing.
