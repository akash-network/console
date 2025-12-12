import { useCallback } from "react";

import { useServices } from "@src/context/ServicesProvider";

export const useBackNav = (fallback: string) => {
  const { router, windowHistory } = useServices();

  return useCallback(() => {
    if (windowHistory.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, windowHistory, fallback]);
};
