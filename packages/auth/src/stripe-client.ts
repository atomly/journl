import Stripe from "stripe";
import { authEnv } from "./env";

export const stripeClient = new Stripe(authEnv().STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});
