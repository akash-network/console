import { addressRouter } from "@src/address";
import { apiKeysRouter, sendVerificationEmailRouter } from "@src/auth";
import { verifyEmailRouter } from "@src/auth/routes/verify-email/verify-email.router";
import { bidsRouter } from "@src/bid/routes/bids/bids.router";
import {
  checkoutRouter,
  getBalancesRouter,
  getWalletListRouter,
  signAndBroadcastTxRouter,
  startTrialRouter,
  stripeCouponsRouter,
  stripeCustomersRouter,
  stripePaymentMethodsRouter,
  stripePricesRouter,
  stripeTransactionsRouter,
  stripeWebhook,
  usageRouter,
  walletSettingRouter
} from "@src/billing";
import { blockPredictionRouter, blocksRouter } from "@src/block";
import { certificateRouter } from "@src/certificate/routes/certificate.router";
import type { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { dashboardDataRouter, graphDataRouter, leasesDurationRouter, marketDataRouter, networkCapacityRouter } from "@src/dashboard";
import { deploymentSettingRouter } from "@src/deployment/routes/deployment-setting/deployment-setting.router";
import { deploymentsRouter } from "@src/deployment/routes/deployments/deployments.router";
import { leasesRouter } from "@src/deployment/routes/leases/leases.router";
import { gpuRouter } from "@src/gpu";
import { networkRouter } from "@src/network";
import { pricingRouter } from "@src/pricing";
import { proposalsRouter } from "@src/proposal";
import {
  auditorsRouter,
  providerAttributesSchemaRouter,
  providerDashboardRouter,
  providerDeploymentsRouter,
  providerEarningsRouter,
  providerGraphDataRouter,
  providerJwtTokenRouter,
  providerRegionsRouter,
  providersRouter,
  providerVersionsRouter
} from "@src/provider";
import { templatesRouter } from "@src/template";
import { transactionsRouter } from "@src/transaction";
import { createAnonymousUserRouter, getAnonymousUserRouter, getCurrentUserRouter, registerUserRouter } from "@src/user";
import { validatorsRouter } from "@src/validator";

export const openApiHonoHandlers: OpenApiHonoHandler[] = [
  startTrialRouter,
  getWalletListRouter,
  walletSettingRouter,
  signAndBroadcastTxRouter,
  checkoutRouter,
  stripeWebhook,
  stripePricesRouter,
  stripeCouponsRouter,
  stripeCustomersRouter,
  stripePaymentMethodsRouter,
  stripeTransactionsRouter,
  usageRouter,
  createAnonymousUserRouter,
  getAnonymousUserRouter,
  registerUserRouter,
  getCurrentUserRouter,
  sendVerificationEmailRouter,
  verifyEmailRouter,
  deploymentSettingRouter,
  deploymentsRouter,
  leasesRouter,
  apiKeysRouter,
  bidsRouter,
  certificateRouter,
  getBalancesRouter,
  providersRouter,
  auditorsRouter,
  providerAttributesSchemaRouter,
  providerRegionsRouter,
  providerDashboardRouter,
  providerEarningsRouter,
  providerVersionsRouter,
  providerGraphDataRouter,
  providerDeploymentsRouter,
  providerJwtTokenRouter,
  graphDataRouter,
  dashboardDataRouter,
  networkCapacityRouter,
  blocksRouter,
  blockPredictionRouter,
  transactionsRouter,
  marketDataRouter,
  validatorsRouter,
  pricingRouter,
  gpuRouter,
  proposalsRouter,
  templatesRouter,
  leasesDurationRouter,
  addressRouter,
  networkRouter
];
