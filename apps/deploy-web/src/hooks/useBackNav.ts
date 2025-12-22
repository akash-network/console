import { useCallback } from "react";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";

export const useBackNav = (fallback: string) => {
  const { windowHistory } = useServices();
  const router = useRouter();

  return useCallback(() => {
    if (windowHistory.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router.asPath, windowHistory, fallback]);
};
