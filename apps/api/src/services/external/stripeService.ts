import { UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { PlanCode } from "@akashnetwork/database/plans";
import Stripe from "stripe";

import { env } from "@src/utils/env";

const stripe = new Stripe(process.env.StripeSecretKey, { apiVersion: "2022-08-01" });

export async function getBillingPortalUrl(userId: string) {
  const userSettings = await UserSetting.findOne({ where: { userId: userId } });

  if (!userSettings.stripeCustomerId) {
    throw new Error("User has no stripe customer id");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: userSettings.stripeCustomerId,
    return_url: `${env.WebsiteUrl}/settings`
  });

  return session.url;
}

export async function getCheckoutUrl(userId: string, planCode: string, isMonthly: boolean) {
  const userSettings = await UserSetting.findOne({ where: { userId: userId } });

  if (!userSettings.email) {
    throw new Error("User email not set: " + userId);
  }

  const products = await stripe.products.search({
    query: `metadata["code"]:"${planCode}"`
  });

  if (products.data.length === 0) {
    throw new Error("Plan not found: " + planCode);
  } else if (products.data.length > 1) {
    throw new Error("Multiple plans found: " + planCode);
  }

  const prices = await stripe.prices.list({
    product: products.data[0].id
  });

  const price = prices.data.find(x => x.recurring.interval === (isMonthly ? "month" : "year") && x.active === true);

  if (!userSettings.stripeCustomerId) {
    const createdCustomer = await stripe.customers.create({ email: userSettings.email });
    userSettings.stripeCustomerId = createdCustomer.id;
    await userSettings.save();
  }

  const session = await stripe.checkout.sessions.create({
    billing_address_collection: "auto",
    customer: userSettings.stripeCustomerId || undefined,
    customer_email: userSettings.stripeCustomerId ? undefined : userSettings.email,
    line_items: [
      {
        price: price.id,
        quantity: 1
      }
    ],
    automatic_tax: {
      enabled: true
    },
    customer_update: {
      address: "auto"
    },
    mode: "subscription",
    success_url: `${env.WebsiteUrl}/settings`,
    cancel_url: `${env.WebsiteUrl}/pricing`
  });

  return session.url;
}

export async function getUserPlan(stripeCustomerId: string): Promise<PlanCode> {
  if (!stripeCustomerId) {
    return "COMMUNITY";
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1
  });

  if (subscriptions.data.length === 0) {
    console.warn("Stripe customer with no subscriptions: " + stripeCustomerId);
    return "COMMUNITY";
  }

  const productId = subscriptions.data[0].items.data[0].price.product;

  const product = await stripe.products.retrieve(productId as string);

  if (!product.metadata.code) {
    throw new Error("Subscription product has no code: " + subscriptions.data[0].id);
  }

  return product.metadata.code as PlanCode;
}
