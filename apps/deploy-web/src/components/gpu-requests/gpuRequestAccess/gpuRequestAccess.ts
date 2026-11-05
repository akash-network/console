import type { OrganizationRole } from "@src/types/organization";
import type { GpuRequestOffer } from "../gpuOfferComparison/gpuOfferComparison";
import type { HardwareRequest, HardwareRequestStatus } from "../gpuRequestStatus/gpuRequestStatus";

export type GpuRequestViewer = { userId: string | undefined; role: OrganizationRole | undefined };

const WITHDRAWABLE_STATUSES: HardwareRequestStatus[] = ["submitted", "in_review", "sourcing", "offers"];

const isOwnerOrAdmin = (role: OrganizationRole | undefined): boolean => role === "owner" || role === "admin";

/** Mirrors the api, which lets the requester and the organization's owners and admins withdraw until an offer is accepted. */
export function canWithdraw(request: Pick<HardwareRequest, "status" | "userId">, viewer: GpuRequestViewer): boolean {
  if (!WITHDRAWABLE_STATUSES.includes(request.status)) return false;

  return request.userId === viewer.userId || isOwnerOrAdmin(viewer.role);
}

export type OfferDecisions = { canAccept: boolean; canDecline: boolean; canAskForApproval: boolean };

const NO_DECISIONS: OfferDecisions = { canAccept: false, canDecline: false, canAskForApproval: false };

/** Mirrors the api: owners and admins accept, the requester may also decline, and everyone else in the organization asks for approval. */
export function describeOfferDecisions(
  request: Pick<HardwareRequest, "status" | "userId">,
  offer: Pick<GpuRequestOffer, "status" | "expired">,
  viewer: GpuRequestViewer
): OfferDecisions {
  if (request.status !== "offers" || offer.status !== "published") return NO_DECISIONS;

  const canCommit = isOwnerOrAdmin(viewer.role);
  return {
    canAccept: canCommit && !offer.expired,
    canDecline: canCommit || request.userId === viewer.userId,
    canAskForApproval: !!viewer.role && !canCommit && !offer.expired
  };
}
