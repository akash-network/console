import { useCallback } from "react";
import { useRouter } from "next/navigation";

export const useBackNav = (fallback: string) => {
  const router = useRouter();

  return useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
};
