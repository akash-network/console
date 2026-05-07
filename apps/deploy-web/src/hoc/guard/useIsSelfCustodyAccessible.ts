import { useIsSelfCustodyEnabled } from "@src/hooks/useIsSelfCustodyEnabled";

export const DEPENDENCIES = {
  useIsSelfCustodyEnabled
};

export const useIsSelfCustodyAccessible = (dependencies: typeof DEPENDENCIES = DEPENDENCIES) => {
  return {
    canVisit: dependencies.useIsSelfCustodyEnabled(),
    isLoading: false
  };
};
