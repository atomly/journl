import { db } from "@acme/db/client";
import { Plan } from "@acme/db/schema";
import { stripe } from "@better-auth/stripe";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { stripeClient } from "./stripe-client";
import { handleStripeWebhookEvent } from "./stripe-webhooks";
import { createInitialUsagePeriodForUser } from "./usage/usage-period-lifecycle";

export function initAuth(options: {
  appName: string;
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}) {
  const config = {
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github", "discord"],
      },
    },
    appName: options.appName,
    baseURL: options.baseUrl,
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      stripe({
        createCustomerOnSignUp: true,
        onCustomerCreate: async ({ user }) => {
          await createInitialUsagePeriodForUser(user.id);
        },
        onEvent: handleStripeWebhookEvent,
        schema: {
          subscription: {
            fields: {
              plan: "planName",
              stripeCustomerId: "stripeCustomerId",
            },
            modelName: "Subscription",
          },
        },
        stripeClient,
        stripeWebhookSecret: options.stripeWebhookSecret,
        subscription: {
          authorizeReference: async ({ user, referenceId, action }) => {
            // Check if the user has permission to manage subscriptions for this reference
            if (
              action === "upgrade-subscription" ||
              action === "cancel-subscription" ||
              action === "restore-subscription"
            ) {
              return user.id === referenceId;
            }

            return true;
          },
          enabled: true,
          plans: async () => {
            const plans = await db.query.Plan.findMany({
              where: eq(Plan.active, true),
              with: {
                price: true,
              },
            });

            return plans.map((plan) => ({
              limits: {
                quota: plan.quota,
              },
              name: plan.name,
              priceId: plan.price.id,
            }));
          },
        },
      }),
      oAuthProxy({
        /**
         * Auto-inference blocked by https://github.com/better-auth/better-auth/pull/2891
         */
        currentURL: options.baseUrl,
        productionURL: options.productionUrl,
      }),
      organization(),
    ],
    secret: options.secret,
    socialProviders: {
      // Social providers can be added here when needed
      github: {
        clientId: options.githubClientId,
        clientSecret: options.githubClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/github`,
      },
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/google`,
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
