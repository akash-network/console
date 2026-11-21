import type { TemplateHardware } from "@src/template/types/template";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";

export type LegacyHardware = { cpu: number; ram: number; storage: number };

/** The legacy columns hold millicpu and bytes, which is what the legacy template page reads. */
export function legacyHardwareOf(hardware: TemplateHardware | null | undefined): LegacyHardware {
  return {
    cpu: Math.round((hardware?.cpu ?? 0) * 1000),
    ram: hardware?.memoryBytes ?? 0,
    storage: hardware?.storageBytes ?? 0
  };
}

/** What the legacy template columns must hold for a version that became the current one after it was saved. */
export function legacyMirrorOf(version: { sdl: string; resources: TemplateHardware | null }): LegacyHardware & { sdl: string } {
  return { sdl: version.sdl, ...legacyHardwareOf(version.resources ?? summarizeTemplateHardware(version.sdl)) };
}
