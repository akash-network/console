import { useCallback } from "react";
import throttle from "lodash/throttle";

export const useThrottledCallback = (effect, deps, delay) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    throttle(() => {
      effect();
    }, delay),
    [...(deps || []), delay]
  );
};
