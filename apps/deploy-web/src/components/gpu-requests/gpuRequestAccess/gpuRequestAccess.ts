import type { OrganizationRole } from "@src/types/organization";
import type { HardwareRequest, HardwareRequestStatus } from "../gpuRequestStatus/gpuRequestStatus";

export type GpuRequestViewer = { userId: string | undefined; role: OrganizationRole | undefined };

const WITHDRAWABLE_STATUSES: HardwareRequestStatus[] = ["submitted", "in_review", "sourcing", "offers"];

const isOwnerOrAdmin = (role: OrganizationRole | undefined): boolean => role === "owner" || role === "admin";

/** Mirrors the api, which lets the requester and the organization's owners and admins withdraw until an offer is accepted. */
export function canWithdraw(request: Pick<HardwareRequest, "status" | "userId">, viewer: GpuRequestViewer): boolean {
  if (!WITHDRAWABLE_STATUSES.includes(request.status)) return false;

  return request.userId === viewer.userId || isOwnerOrAdmin(viewer.role);
}
