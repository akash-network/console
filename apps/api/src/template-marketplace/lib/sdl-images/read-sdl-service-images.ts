import { yaml } from "@akashnetwork/chain-sdk";

export type SdlServiceImage = { service: string; image: string };

/** Reads the image of each service as written, and nothing from an SDL that does not parse. */
export function readSdlServiceImages(sdl: string): SdlServiceImage[] {
  return Object.entries(readSdlServices(sdl)).flatMap(([service, definition]) =>
    isMapping(definition) && typeof definition.image === "string" && definition.image.trim() ? [{ service, image: definition.image.trim() }] : []
  );
}

export function readSdlServices(sdl: string): Record<string, unknown> {
  try {
    const document: unknown = yaml.raw(sdl);

    return isMapping(document) && isMapping(document.services) ? document.services : {};
  } catch {
    return {};
  }
}

export function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
