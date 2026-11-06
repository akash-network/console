import yaml from "js-yaml";

const HTTP_PORT = 80;

interface SdlExpose {
  port?: unknown;
  as?: unknown;
}

/** Reads the ports a service exposes for display only; an SDL that does not parse simply shows none. */
export function exposedPortsOf(sdl: string, service: string): string[] {
  try {
    const document = yaml.load(sdl) as { services?: Record<string, { expose?: SdlExpose[] }> } | null;
    const expose = document?.services?.[service]?.expose ?? [];
    return expose
      .filter(entry => typeof entry.port === "number")
      .map(entry => portLabelOf(entry.port as number, typeof entry.as === "number" ? entry.as : (entry.port as number)));
  } catch {
    return [];
  }
}

function portLabelOf(port: number, as: number): string {
  return `${port} to ${as}${as === HTTP_PORT ? " (HTTP)" : ""}`;
}
