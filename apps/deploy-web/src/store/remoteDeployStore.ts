import { atomWithStorage } from "jotai/utils";

export const tokens = atomWithStorage<{
  accessToken: string | null;
  refreshToken: string | null;
  type: "bitbucket" | "github" | "gitlab";
  alreadyLoggedIn?: string[];
}>("remote-deploy-tokens", {
  accessToken: null,
  refreshToken: null,
  type: "github",
  alreadyLoggedIn: []
});
