import { atomWithStorage } from "jotai/utils";

export const tokens = atomWithStorage<{
  access_token: string | null;
  refresh_token: string | null;
  type: "bitbucket" | "github" | "gitlab";
  alreadyLoggedIn?: string[];
}>("remote-deploy-tokens", {
  access_token: null,
  refresh_token: null,
  type: "github",
  alreadyLoggedIn: []
});
