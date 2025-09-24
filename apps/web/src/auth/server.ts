import { initAuth } from "@acme/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "../env";

const baseUrl =
  env.VERCEL_ENV === "production"
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.VERCEL_ENV === "preview"
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:3000";

export const auth = initAuth({
  appName: "Journl",
  baseUrl,
  githubClientId: env.AUTH_GITHUB_ID,
  githubClientSecret: env.AUTH_GITHUB_SECRET,
  googleClientId: env.AUTH_GOOGLE_ID,
  googleClientSecret: env.AUTH_GOOGLE_SECRET,
  productionUrl: baseUrl,
  secret: env.AUTH_SECRET,
  stripeSecretKey: env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const getUser = cache(async () => {
  const session = await getSession();
  if (!session?.user) {
    return redirect("/");
  }
  return session.user;
});
export type User = Awaited<ReturnType<typeof getUser>>;
