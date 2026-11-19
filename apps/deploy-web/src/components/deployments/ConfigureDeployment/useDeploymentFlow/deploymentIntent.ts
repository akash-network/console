export type SdlStrategy = "default" | "edit";
export type BidStrategy = "auto" | "select";
export type TemplateMode = "new" | "edit";

export interface GpuIntent {
  vendor: "nvidia";
  model: string;
  count: number;
  memory?: string;
  interface?: string;
}

export interface DeploymentIntent {
  templateId?: string;
  /** A user-authored template (`?userTemplateId=`), resolved against the private user-template API rather than the public gallery. */
  userTemplateId?: string;
  /** The version of `userTemplateId` to deploy (`?templateVersion=`); its current version when absent. */
  templateVersion?: number;
  /** The id of the template version the SDL came from, resolved by the Configure screen and never read from the URL. */
  templateVersionId?: string;
  sdlStrategy: SdlStrategy;
  bidStrategy: BidStrategy;
  dseq?: string;
  /** Identifies the persisted working draft. Present once a configure session has started; absent on a fresh entry. */
  draftId?: string;
  /** Container-VM entry (`?vm=true`): the form seeds an SSH-ready VM service instead of the blank default. */
  vm: boolean;
  /** Onboarding's Deploy image entry (`?exampleImage=true`): the form seeds a working example image instead of a blank one. */
  exampleImage?: boolean;
  /** A GPU setup linked from a GPU alert email (`?gpuVendor=&gpuModel=&gpuCount=`): the form seeds its first service with it instead of the blank one. */
  gpu?: GpuIntent;
  /** Authoring a template (`?templateMode=`) rather than deploying: `edit` saves a new version of `userTemplateId`. */
  templateMode?: TemplateMode;
  /** A new template copied from this template's `copyFromVersion`. */
  copyFromTemplateId?: string;
  copyFromVersion?: number;
  /** The version an edit started from, pinned for the whole session so a save after a colleague's is refused rather than applied over it. */
  baseVersion?: number;
  /** The deployment a new template is saved from. */
  sourceDseq?: string;
}

const MAX_LINKED_GPU_COUNT = 64;

interface ParseInput {
  /** The optional catch-all route segment (`/configure/[[...dseq]]`); the deployment's dseq once it exists. */
  dseqSegment: string | undefined;
  searchParams: URLSearchParams;
}

interface ParseOptions {
  /** Without it the URL parses exactly as it did before the template marketplace: no template mode and no template version. */
  isTemplateModeEnabled: boolean;
}

/**
 * Maps the declarative configure URL to a normalized intent. Strategy values fall back to the
 * safe manual defaults (`edit`/`select`) on anything unrecognized, and `sdl-strategy` is only
 * honored alongside a `templateId` (it governs creating *from a template*). A `vm=true` entry
 * is a Container-VM seed, not a template build: it drops any `templateId` (and with it the
 * `default` strategy), so the manual form always opens. The two template sources are mutually
 * exclusive and resolved here rather than downstream: a `vm` entry drops both, and a gallery
 * `templateId` wins over a `userTemplateId`. A user template never carries a `sdl-strategy`, so
 * it always opens the manual form rather than the auto-deploy flow. An `exampleImage=true` entry
 * only changes the blank default, so a `vm` entry, which seeds its own service, drops it.
 */
export function parseDeploymentIntent(
  { dseqSegment, searchParams }: ParseInput,
  { isTemplateModeEnabled }: ParseOptions = { isTemplateModeEnabled: false }
): DeploymentIntent {
  const templateMode = isTemplateModeEnabled ? toTemplateMode(searchParams.get("templateMode")) : undefined;
  if (templateMode) return parseTemplateIntent(templateMode, searchParams);

  const intent = parseDeployIntent(dseqSegment, searchParams);
  const templateVersion = isTemplateModeEnabled && intent.userTemplateId ? toVersion(searchParams.get("templateVersion")) : undefined;
  return templateVersion ? { ...intent, templateVersion } : intent;
}

/** Authoring never deploys, so a template intent carries none of the params that choose what, where or how to deploy. */
function parseTemplateIntent(requestedMode: TemplateMode, searchParams: URLSearchParams): DeploymentIntent {
  const userTemplateId = searchParams.get("userTemplateId") || undefined;
  const modeFields = requestedMode === "edit" && userTemplateId ? editFieldsOf(userTemplateId, searchParams) : newFieldsOf(searchParams);
  return {
    ...modeFields,
    sdlStrategy: "edit",
    bidStrategy: "select",
    draftId: searchParams.get("draftId") || undefined,
    vm: false,
    exampleImage: false
  };
}

function editFieldsOf(userTemplateId: string, searchParams: URLSearchParams): Partial<DeploymentIntent> {
  const baseVersion = toVersion(searchParams.get("baseVersion"));
  return { templateMode: "edit", userTemplateId, ...(baseVersion ? { baseVersion } : {}) };
}

function newFieldsOf(searchParams: URLSearchParams): Partial<DeploymentIntent> {
  const copyFromTemplateId = searchParams.get("copyFromTemplateId") || undefined;
  const copyFromVersion = toVersion(searchParams.get("copyFromVersion"));
  const sourceDseq = searchParams.get("sourceDseq") ?? "";
  return {
    templateMode: "new",
    ...(copyFromTemplateId && copyFromVersion ? { copyFromTemplateId, copyFromVersion } : {}),
    ...(/^\d+$/.test(sourceDseq) ? { sourceDseq } : {})
  };
}

function parseDeployIntent(dseqSegment: string | undefined, searchParams: URLSearchParams): DeploymentIntent {
  const vm = searchParams.get("vm") === "true";
  const templateId = vm ? undefined : searchParams.get("templateId") ?? undefined;
  const userTemplateId = vm || templateId ? undefined : searchParams.get("userTemplateId") || undefined;
  const sdlStrategy = templateId ? toSdlStrategy(searchParams.get("sdl-strategy")) : "edit";
  const bidStrategy = toBidStrategy(searchParams.get("bid-strategy"));
  const draftId = searchParams.get("draftId") || undefined;
  const exampleImage = !vm && searchParams.get("exampleImage") === "true";
  const gpu = vm || templateId || userTemplateId || draftId ? undefined : toGpuIntent(searchParams);
  return { templateId, userTemplateId, sdlStrategy, bidStrategy, dseq: dseqSegment || undefined, draftId, vm, exampleImage, ...(gpu ? { gpu } : {}) };
}

function toGpuIntent(searchParams: URLSearchParams): GpuIntent | undefined {
  const model = searchParams.get("gpuModel");
  const count = searchParams.get("gpuCount") ?? "";
  if (searchParams.get("gpuVendor") !== "nvidia" || !model || !/^\d+$/.test(count) || Number(count) < 1 || Number(count) > MAX_LINKED_GPU_COUNT)
    return undefined;
  const memory = searchParams.get("gpuMemory") || undefined;
  const gpuInterface = toGpuInterface(searchParams.get("gpuInterface"));
  return { vendor: "nvidia", model, count: Number(count), ...(memory ? { memory } : {}), ...(gpuInterface ? { interface: gpuInterface } : {}) };
}

/** Providers advertise the interconnect as `sxm` or `pcie`, so a generation suffix like `sxm5` would match no bid. */
function toGpuInterface(value: string | null): string | undefined {
  return value ? value.replace(/^sxm\d+$/, "sxm") : undefined;
}

function toTemplateMode(value: string | null): TemplateMode | undefined {
  return value === "new" || value === "edit" ? value : undefined;
}

function toVersion(value: string | null): number | undefined {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** Narrows the raw `sdl-strategy` param to the union, defaulting to `edit`. */
function toSdlStrategy(value: string | null): SdlStrategy {
  return value === "default" ? "default" : "edit";
}

/** Narrows the raw `bid-strategy` param to the union, defaulting to `select`. */
function toBidStrategy(value: string | null): BidStrategy {
  return value === "auto" ? "auto" : "select";
}
