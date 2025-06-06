import { useCallback } from "react";
import { useRouter } from "next/navigation";

export const useBackNav = (fallback: string) => {
  const router = useRouter();

  return useCallback(() => {
    console.log("DEBUG window.history.length", window.history.length);
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
};
