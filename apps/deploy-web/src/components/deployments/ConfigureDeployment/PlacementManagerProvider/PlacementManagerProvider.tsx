import type { FC, ReactNode } from "react";
import { createContext, useContext } from "react";

import type { PlacementManager } from "../usePlacementManager/usePlacementManager";
import { usePlacementManager } from "../usePlacementManager/usePlacementManager";

const PlacementManagerContext = createContext<PlacementManager | null>(null);

type Props = {
  onSelectService: (serviceId: string) => void;
  children: ReactNode;
};

/** A second `useFieldArray` over the services keeps its own stale copy of the array, so every structural change goes through this one manager. */
export const PlacementManagerProvider: FC<Props> = ({ onSelectService, children }) => {
  const manager = usePlacementManager({ onSelectService });
  return <PlacementManagerContext.Provider value={manager}>{children}</PlacementManagerContext.Provider>;
};

export function usePlacementManagerContext(): PlacementManager {
  const manager = useContext(PlacementManagerContext);
  if (!manager) {
    throw new Error("usePlacementManagerContext must be used within a PlacementManagerProvider");
  }
  return manager;
}
