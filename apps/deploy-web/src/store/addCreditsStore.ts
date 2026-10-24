import type { ReactNode } from "react";
import { atom } from "jotai";

import type { AddCreditsTab } from "@src/components/billing-usage/AddCreditsTabs/AddCreditsTabs";

export type AddCreditsRequest = {
  initialTab?: AddCreditsTab;
  description?: ReactNode;
  deploymentDailyCostUsd?: number;
  /** Where the sheet was opened from; sent with its lifecycle events for funnel segmentation. */
  context?: string;
  nextStepLabel?: string;
  /** On unless `nextStepLabel` is set; off where the user is mid-task, so a purchase never offers to deploy something else. */
  suggestFirstDeployment?: boolean;
  /** Runs once a purchase is confirmed in the balance, never on a cancel or a coupon (whose credits can still be settling), so the call site can pick up where the user left off. */
  onCreditsAdded?: () => void;
};

/**
 * The pending request to open the app-wide Add Credits sheet. An atom rather than a context because the
 * insufficient-funds snackbar renders in notistack's portal, above every provider that could host the sheet.
 */
export const addCreditsRequestAtom = atom<AddCreditsRequest | null>(null);
