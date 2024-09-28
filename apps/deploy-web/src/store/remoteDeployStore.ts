import { atomWithStorage } from "jotai/utils";

import { OAuth } from "@src/components/remote-deploy/helper-functions";

export const tokens = atomWithStorage<{
  access_token: string | null;
  refresh_token: string | null;
  type: OAuth;
  alreadyLoggedIn?: string[];
}>("remote-deploy-tokens", {
  access_token: null,
  refresh_token: null,
  type: "github",
  alreadyLoggedIn: []
});
