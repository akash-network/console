import yaml from "js-yaml";

export interface ServiceRuntime {
  command: string[];
  args: string[];
  env: string[];
}

interface SdlServiceRuntime {
  command?: unknown;
  args?: unknown;
  env?: unknown;
}

/** Reads what a service runs for display only; an SDL that does not parse simply shows nothing extra. */
export function serviceRuntimeOf(sdl: string, service: string): ServiceRuntime {
  try {
    const document = yaml.load(sdl) as { services?: Record<string, SdlServiceRuntime | null> } | null;
    const runtime = document?.services?.[service];
    return { command: stringsOf(runtime?.command), args: stringsOf(runtime?.args), env: stringsOf(runtime?.env) };
  } catch {
    return { command: [], args: [], env: [] };
  }
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
