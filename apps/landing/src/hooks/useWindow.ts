import { useEffect, useState } from "react";

export function useWindow(): Window | undefined {
  const [stateWindow, setStateWindow] = useState<Window | undefined>(undefined);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setStateWindow(window);
    }
  }, [setStateWindow]);
  return stateWindow;
}
