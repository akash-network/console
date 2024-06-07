import { useState } from "react";

import { useWhen } from "@src/hooks/useWhen";
import { useWindow } from "@src/hooks/useWindow";

// Define general type for useWindowSize hook, which includes width and height
interface Size {
  width: number | undefined;
  height: number | undefined;
}

// Hook
export function useWindowSize(): Size {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState<Size>({
    width: undefined,
    height: undefined
  });
  const window = useWindow();
  useWhen(window, () => {
    // Handler to call on window resize
    function resize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
    // Add event listener
    window.addEventListener("resize", resize);
    // Call handler right away so state gets updated with initial window size
    resize();
    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", resize);
  }); // Empty array ensures that effect is only run on mount

  return windowSize;
}
