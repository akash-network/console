import { yaml } from "@akashnetwork/chain-sdk";

import { exceedsSubmittableLength } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";

export const TEMPLATE_VERSION_CHANGES = [
  "first_version",
  "service_added",
  "service_removed",
  "image_changed",
  "image_tag_changed",
  "env_changed",
  "ports_changed",
  "resources_changed",
  "asked_value_added",
  "asked_value_removed",
  "asked_value_changed",
  "readme_changed"
] as const;

export type TemplateVersionChange = (typeof TEMPLATE_VERSION_CHANGES)[number];

export type VersionContent = {
  sdl: string;
  readme: string | null;
  askedValues: AskedValue[];
};

type Mapping = Record<string, unknown>;

type ParsedSdl = {
  services: Mapping;
  compute: unknown;
};

export function summarizeVersionChanges(previous: VersionContent | undefined, next: VersionContent): TemplateVersionChange[] {
  if (!previous) return ["first_version"];

  const found = new Set<TemplateVersionChange>();
  const previousSdl = parseSdl(previous.sdl);
  const nextSdl = parseSdl(next.sdl);

  if (previousSdl && nextSdl) {
    collectSdlChanges(previousSdl, nextSdl, found);
  }
  collectAskedValueChanges(previous.askedValues, next.askedValues, found);
  if (previous.readme !== next.readme) found.add("readme_changed");

  return TEMPLATE_VERSION_CHANGES.filter(change => found.has(change));
}

function collectSdlChanges(previous: ParsedSdl, next: ParsedSdl, found: Set<TemplateVersionChange>) {
  for (const name of Object.keys(next.services)) {
    if (!(name in previous.services)) found.add("service_added");
  }

  for (const [name, previousService] of Object.entries(previous.services)) {
    if (!(name in next.services)) {
      found.add("service_removed");
      continue;
    }
    collectServiceChanges(asMapping(previousService), asMapping(next.services[name]), found);
  }

  if (!isSame(previous.compute, next.compute)) found.add("resources_changed");
}

function collectServiceChanges(previous: Mapping, next: Mapping, found: Set<TemplateVersionChange>) {
  if (typeof previous.image === "string" && typeof next.image === "string" && previous.image !== next.image) {
    found.add(repositoryOf(previous.image) === repositoryOf(next.image) ? "image_tag_changed" : "image_changed");
  }

  if (!isSameSet(asList(previous.env), asList(next.env))) found.add("env_changed");
  if (!isSame(previous.expose, next.expose)) found.add("ports_changed");
}

function collectAskedValueChanges(previous: AskedValue[], next: AskedValue[], found: Set<TemplateVersionChange>) {
  const previousByKey = new Map(previous.map(value => [value.key, value]));
  const nextByKey = new Map(next.map(value => [value.key, value]));

  for (const [key, value] of nextByKey) {
    const before = previousByKey.get(key);
    if (!before) found.add("asked_value_added");
    else if (!isSame(before, value)) found.add("asked_value_changed");
  }

  for (const key of previousByKey.keys()) {
    if (!nextByKey.has(key)) found.add("asked_value_removed");
  }
}

function repositoryOf(image: string): string {
  const separator = image.lastIndexOf(":");

  return separator > image.lastIndexOf("/") ? image.slice(0, separator) : image;
}

function parseSdl(sdl: string): ParsedSdl | undefined {
  let document: unknown;
  try {
    document = yaml.raw(sdl);
  } catch {
    return undefined;
  }

  if (!isMapping(document) || exceedsSubmittableLength(sdl, document)) return undefined;

  const profiles = asMapping(document.profiles);

  return { services: asMapping(document.services), compute: profiles.compute };
}

function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asMapping(value: unknown): Mapping {
  return isMapping(value) ? value : {};
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function isSame(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSameSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  return leftSet.size === rightSet.size && [...leftSet].every(item => rightSet.has(item));
}
