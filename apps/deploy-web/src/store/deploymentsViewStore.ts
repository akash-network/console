import { atomWithStorage } from "jotai/utils";

export type DeploymentsViewMode = "grid" | "list";

export const deploymentsViewModeAtom = atomWithStorage<DeploymentsViewMode>("deploymentsViewMode", "grid");
