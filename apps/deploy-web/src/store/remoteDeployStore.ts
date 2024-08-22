import { atomWithStorage } from "jotai/utils";

import { OAuth } from "@src/components/remote-deploy/utils";

const tokens = atomWithStorage<{
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

const remoteDeployStore = {
  tokens
};

export default remoteDeployStore;
