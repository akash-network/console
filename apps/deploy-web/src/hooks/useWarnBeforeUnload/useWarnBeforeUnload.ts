import { useEffect } from "react";

/** Asks the browser to confirm a reload, a closed tab or a hard navigation while `isActive`; in-app navigation is not covered. */
export function useWarnBeforeUnload(isActive: boolean): void {
  useEffect(
    function warnBeforeUnloadWhileActive() {
      if (!isActive) return;

      function askToStay(event: BeforeUnloadEvent) {
        event.preventDefault();
      }

      window.addEventListener("beforeunload", askToStay);
      return function stopWarning() {
        window.removeEventListener("beforeunload", askToStay);
      };
    },
    [isActive]
  );
}
