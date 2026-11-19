import { imageRepositoryOf } from "@src/template-marketplace/lib/publish-checks/image-reference";
import { isMapping, readSdlServiceImages, readSdlServices } from "@src/template-marketplace/lib/sdl-images/read-sdl-service-images";

export const TEMPLATE_VERSION_HOLD_KINDS = ["official_template", "image_repository_changed", "global_port_added"] as const;

export type TemplateVersionHoldKind = (typeof TEMPLATE_VERSION_HOLD_KINDS)[number];

export type TemplateVersionHoldReason = {
  kind: TemplateVersionHoldKind;
  /** Plain text for the publisher and for staff. */
  message: string;
  service?: string;
  image?: string;
  /** What the same service ran in the current version, absent for a service the current version does not have. */
  previousImage?: string;
  port?: number;
  protocol?: string;
};

type GlobalPort = { service: string; port: number; protocol: string };

const DEFAULT_PROTOCOL = "tcp";

export const OFFICIAL_TEMPLATE_HOLD_REASON: TemplateVersionHoldReason = {
  kind: "official_template",
  message: "This is an Official template, so Akash staff review every new version before it goes live."
};

/** Lists what a new version changes that could turn a trusted template into something else: an image repository the current version does not run, or a port it newly opens to the internet. */
export function findRiskyVersionChanges(currentSdl: string, nextSdl: string): TemplateVersionHoldReason[] {
  return [...findNewImageRepositories(currentSdl, nextSdl), ...findNewGlobalPorts(currentSdl, nextSdl)];
}

/** Compares the repositories of the whole version, so moving an image between services or renaming a service adds nothing new. */
function findNewImageRepositories(currentSdl: string, nextSdl: string): TemplateVersionHoldReason[] {
  const currentImages = readSdlServiceImages(currentSdl);
  const repositoriesRunToday = new Set(currentImages.map(({ image }) => imageRepositoryOf(image)));
  const imageRunTodayBy = new Map(currentImages.map(({ service, image }) => [service, image]));

  return readSdlServiceImages(nextSdl)
    .filter(({ image }) => !repositoriesRunToday.has(imageRepositoryOf(image)))
    .map(({ service, image }) => {
      const previousImage = imageRunTodayBy.get(service);

      return {
        kind: "image_repository_changed" as const,
        message: previousImage
          ? `Service "${service}" moves from ${previousImage} to ${image}, an image repository the current version does not run.`
          : `Service "${service}" runs ${image}, an image repository the current version does not run.`,
        service,
        image,
        ...(previousImage && { previousImage })
      };
    });
}

function findNewGlobalPorts(currentSdl: string, nextSdl: string): TemplateVersionHoldReason[] {
  const openToday = new Set(readGlobalPorts(currentSdl).map(globalPortKey));

  return readGlobalPorts(nextSdl)
    .filter(globalPort => !openToday.has(globalPortKey(globalPort)))
    .map(({ service, port, protocol }) => ({
      kind: "global_port_added" as const,
      message: `Service "${service}" opens port ${port} (${protocol}) to the internet, which the current version does not.`,
      service,
      port,
      protocol
    }));
}

/** A port is told by the service and what listens on it, so serving the same container port under another external number, or to other hostnames, opens nothing new. */
function readGlobalPorts(sdl: string): GlobalPort[] {
  const found = new Map<string, GlobalPort>();

  for (const [service, definition] of Object.entries(readSdlServices(sdl))) {
    for (const exposed of asList(isMapping(definition) ? definition.expose : undefined).filter(isMapping)) {
      const port = Number(exposed.port);

      if (!Number.isInteger(port) || !asList(exposed.to).some(isGlobalTarget)) continue;

      const globalPort = { service, port, protocol: typeof exposed.proto === "string" ? exposed.proto.toLowerCase() : DEFAULT_PROTOCOL };
      found.set(globalPortKey(globalPort), globalPort);
    }
  }

  return [...found.values()];
}

function isGlobalTarget(target: unknown): boolean {
  return isMapping(target) && target.global === true;
}

function globalPortKey({ service, port, protocol }: GlobalPort): string {
  return JSON.stringify([service, port, protocol]);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
