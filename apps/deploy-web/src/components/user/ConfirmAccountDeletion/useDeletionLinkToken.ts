import { useEffect, useState } from "react";

/** The token rides in the fragment so it never reaches a server log, and is dropped from the address bar once read. */
export function useDeletionLinkToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(function readTokenFromLink() {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token"));
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  return token;
}
