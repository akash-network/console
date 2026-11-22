import { parseSdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";

export function definitionOf(sdl: string): Record<string, unknown> | null {
  const { document } = parseSdlForStorage(sdl);

  return document ? Object.fromEntries(Object.entries(document)) : null;
}
