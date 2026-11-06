import {
  importDeploymentState,
  isKnownSdlParserError,
  NoVisibleServiceError
} from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";

const UNREADABLE_SDL_REASON = "Its configuration couldn't be read.";

/** The editor starts from a blank deployment when it can't import an SDL, so a card refuses that SDL rather than open the editor without it. */
export function assertOpensInEditor(sdl: string): void {
  try {
    importDeploymentState(sdl);
  } catch (cause) {
    throw new Error(`The editor can't open this SDL. ${reasonOf(cause)}`, { cause });
  }
}

function reasonOf(cause: unknown): string {
  return cause instanceof NoVisibleServiceError || isKnownSdlParserError(cause) ? cause.message : UNREADABLE_SDL_REASON;
}
