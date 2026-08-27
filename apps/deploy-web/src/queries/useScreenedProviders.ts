import { useMemo } from "react";
import type { VerificationRequirement } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk/web";
import type { paths } from "@akashnetwork/console-api-types";
import { keepPreviousData } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { AUDITOR } from "@src/utils/deploymentData/v1beta3";

export type ScreeningRequest = NonNullable<paths["/v1/bid-screening"]["post"]["requestBody"]>["content"]["application/json"];
type VerificationRequirementRequest = NonNullable<NonNullable<ScreeningRequest["requirements"]>["verification"]>;

/** The screening request minus `timezone`, which the hook attaches from the client's resolved locale. */
export type ScreeningRequestBody = Omit<ScreeningRequest, "timezone" | "requirements"> & {
  requirements: ScreeningRequest["requirements"] & { verification?: VerificationRequirementRequest };
};

type GeneratedScreenedProvidersResponse = paths["/v1/bid-screening"]["post"]["responses"][200]["content"]["application/json"];
type GeneratedScreenedProvider = GeneratedScreenedProvidersResponse["providers"][number];

export interface ProviderVerificationSummary {
  bestStatusValidTier: number;
  tierGateTier: number;
  capabilities: number[];
  validAttestationCount: number;
  validAuditors: string[];
  snapshotState: "unknown" | "not_posted" | "current" | "stale" | "suspended";
  observedHeight: string;
}

export type ProviderVerificationFailure =
  | { code: "snapshot_not_posted" }
  | { code: "snapshot_suspended" }
  | { code: "snapshot_stale" }
  | { code: "insufficient_tier"; actual: number; required: number }
  | { code: "missing_capability"; capability: number }
  | { code: "insufficient_auditor_count"; actual: number; required: number }
  | { code: "required_auditor_not_found"; mode: number; missing: string[] };

export interface ProviderVerificationExclusion {
  owner: string;
  firstFailure: ProviderVerificationFailure;
  failures: ProviderVerificationFailure[];
  summary: ProviderVerificationSummary;
}

export type ScreenedProvider = GeneratedScreenedProvider & {
  verification?:
    { outcome: "pass"; summary: ProviderVerificationSummary } | { outcome: "not_evaluated"; incompleteFacts: string[]; summary: ProviderVerificationSummary };
};

export type ScreenedProvidersResponse = Omit<GeneratedScreenedProvidersResponse, "providers"> & {
  providers: ScreenedProvider[];
  exclusions?: ProviderVerificationExclusion[];
};

interface UseScreenedProvidersInput {
  sdl: string;
  placementName: string;
  /**
   * Kept for the call-site contract. A selected region now travels inside the SDL (the placement's
   * `location-region` attribute), so a valid spec already screens by region and an invalid spec shows no
   * providers regardless — screening no longer needs the region threaded in separately.
   */
  region?: string;
  /**
   * Gates the screening query. Defaults to true. Set false once the deployment is locked (quoting/creating/closing):
   * the spec is frozen, so re-running the CPU-heavy screening yields nothing new — the last result is kept (via
   * `keepPreviousData`) while live bids drive the marketplace.
   */
  enabled?: boolean;
}

interface UseScreenedProvidersResult {
  providers: ScreenedProvider[];
  exclusions: ProviderVerificationExclusion[];
  isLoading: boolean;
  isError: boolean;
  /**
   * True when the current SDL can't be turned into a screening request (invalid or incomplete spec). No
   * provider would bid on an unusable spec, so the marketplace shows a message instead of a list — screening
   * does NOT fall back to the full catalog.
   */
  isInvalid: boolean;
}

/** Quiet period after the last spec edit before the current spec is screened. */
export const SCREENING_DEBOUNCE_MS = 400;
/** Hard ceiling so continuous editing still screens the spec at most ~once per this window. */
export const SCREENING_MAX_WAIT_MS = 2000;
/**
 * Image substituted into image-less services when screening (only). `generateManifest` rejects a spec
 * whose service has no image, which would drop a still-being-configured deployment to the empty-resource
 * catalog; the placeholder lets the current spec's resources drive the first screening list instead. The
 * screening request carries resources, not the image, so this value never leaves the client.
 */
export const SCREENING_PLACEHOLDER_IMAGE = "placeholder";

/** A stable, never-fetched request used as the query key while screening is skipped (invalid spec), so the key doesn't churn. */
const SKIPPED_SCREENING_REQUEST: ScreeningRequest = { ...buildCatalogScreeningRequest(), timezone: "UTC" };

/**
 * Screens providers for the given placement's group spec. The marketplace is placement-scoped: it converts
 * the current SDL to group specs and queries the one matching `placementName`. When the SDL can't be turned
 * into a screening request (invalid or incomplete spec) it does NOT fall back to the full catalog — no
 * provider would bid on an unusable spec — instead it reports `isInvalid` so the marketplace shows a message.
 * A selected region travels in the SDL, so a valid spec already screens by region. The placement's legacy
 * signedBy and AEP-86 verification policies are forwarded independently.
 */
export function useScreenedProviders({ sdl, placementName, enabled = true }: UseScreenedProvidersInput): UseScreenedProvidersResult {
  const { api } = useServices();
  const request = useMemo(() => {
    const placementRequest = buildPlacementScreeningRequest(sdl, placementName);
    if (!placementRequest) return null;
    return { ...placementRequest, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }, [sdl, placementName]);
  const pacedRequest = usePacedValue(request, { wait: SCREENING_DEBOUNCE_MS, maxWait: SCREENING_MAX_WAIT_MS });
  const isInvalid = pacedRequest === null;
  const query = api.v1.screenProviders.useQuery(pacedRequest ?? SKIPPED_SCREENING_REQUEST, {
    enabled: enabled && !isInvalid,
    placeholderData: keepPreviousData
  });

  return {
    providers: isInvalid ? [] : (query.data?.providers ?? []),
    exclusions: isInvalid ? [] : ((query.data as ScreenedProvidersResponse | undefined)?.exclusions ?? []),
    isLoading: !isInvalid && query.isLoading,
    isError: !isInvalid && query.isError,
    isInvalid
  };
}

/**
 * Converts the current SDL into a screening request for a single placement's group spec. Returns null
 * when the SDL is incomplete/invalid (e.g. mid-edit) or the placement isn't in it yet. `signedBy`,
 * verification, and attributes are copied from the generated group spec without combining their semantics.
 * The proto JSON encodes resource values as decimal integer strings, which the screening endpoint accepts.
 */
export function buildPlacementScreeningRequest(rawSdl: string, placementName: string): ScreeningRequestBody | null {
  if (!rawSdl) return null;

  try {
    // `yaml.raw` throws on malformed YAML (e.g. mid-edit), so the whole conversion is guarded: any
    // parse/manifest failure returns null, letting the caller fall back to the full catalog.
    const parsedSdl = yaml.raw(rawSdl) as SDLInput;
    fillPlaceholderImages(parsedSdl);
    const manifestResult = generateManifest(parsedSdl);
    if (!manifestResult.ok) return null;

    const manifest = manifestResult.value;
    const group = manifest.groupSpecs.find(candidate => candidate.name === placementName);
    if (!group) return null;

    const groupJson = GroupSpec.toJSON(group) as { resources: ScreeningRequest["resources"] };
    const requirements = group.requirements;
    const verification = requirements?.verification ? toVerificationRequirementRequest(requirements.verification) : null;
    if (requirements?.verification && !verification) return null;

    return {
      requirements: {
        signedBy: {
          allOf: requirements?.signedBy?.allOf ?? [],
          anyOf: requirements?.signedBy?.anyOf ?? []
        },
        attributes: requirements?.attributes ?? [],
        ...(verification ? { verification } : {})
      },
      resources: groupJson.resources,
      reclamationWindow: manifest.reclamation?.minWindow?.seconds ? Number(manifest.reclamation?.minWindow?.seconds) : undefined
    };
  } catch {
    return null;
  }
}

export function hasPlacementVerificationRequirement(rawSdl: string, placementName: string): boolean {
  return buildPlacementScreeningRequest(rawSdl, placementName)?.requirements.verification !== undefined;
}

function toVerificationRequirementRequest(requirement: VerificationRequirement): VerificationRequirementRequest | null {
  const minTier = toVerificationTierRequest(requirement.minTier);
  const auditorMode = toAuditorSelectionModeRequest(requirement.auditorMode);
  if (minTier === null || auditorMode === null) return null;

  const requiredCapabilities: NonNullable<VerificationRequirementRequest["requiredCapabilities"]> = [];
  for (const capability of requirement.requiredCapabilities) {
    const mappedCapability = toCapabilityFlagRequest(capability);
    if (mappedCapability === null) return null;
    requiredCapabilities.push(mappedCapability);
  }

  return {
    minTier,
    requiredCapabilities,
    requiredAuditors: requirement.requiredAuditors,
    auditorMode,
    minAuditorCount: requirement.minAuditorCount
  };
}

function toVerificationTierRequest(tier: VerificationTier): VerificationRequirementRequest["minTier"] | null {
  switch (tier) {
    case VerificationTier.verification_tier_unspecified:
    case VerificationTier.verification_tier_identified:
    case VerificationTier.verification_tier_verified:
    case VerificationTier.verification_tier_established:
    case VerificationTier.verification_tier_trusted:
      return tier;
    case VerificationTier.UNRECOGNIZED:
      return null;
  }
}

function toCapabilityFlagRequest(capability: CapabilityFlag): NonNullable<VerificationRequirementRequest["requiredCapabilities"]>[number] | null {
  switch (capability) {
    case CapabilityFlag.capability_tee_hardware_attestation:
    case CapabilityFlag.capability_confidential_computing:
    case CapabilityFlag.capability_persistent_storage:
    case CapabilityFlag.capability_bare_metal:
      return capability;
    case CapabilityFlag.capability_unspecified:
    case CapabilityFlag.UNRECOGNIZED:
      return null;
  }
}

function toAuditorSelectionModeRequest(mode: AuditorSelectionMode): VerificationRequirementRequest["auditorMode"] | null {
  switch (mode) {
    case AuditorSelectionMode.auditor_selection_mode_unspecified:
    case AuditorSelectionMode.auditor_selection_mode_any:
    case AuditorSelectionMode.auditor_selection_mode_all:
      return mode;
    case AuditorSelectionMode.UNRECOGNIZED:
      return null;
  }
}

/**
 * Builds the full audited catalog request (empty resource spec) used before a deployment is configured (no
 * SDL yet, mid-edit/invalid SDL, or no placement selected). Because the region is chosen independently of the
 * SDL, it is honored here too: a selected region is added as a `location-region` attribute constraint. The
 * region key comes from the provider-regions API, which derives it from the same provider attribute values
 * being matched, so it is passed through verbatim. An empty/unset region means "any region", i.e. no
 * constraint. Audited-only via signedBy.
 */
export function buildCatalogScreeningRequest(region?: string): ScreeningRequestBody {
  return {
    requirements: {
      signedBy: { allOf: [AUDITOR] },
      attributes: region ? [{ key: "location-region", value: region }] : []
    },
    resources: []
  };
}

/**
 * Fills a placeholder image into every service still missing one so a mid-configuration spec passes
 * manifest generation for screening. Mutates the throwaway parsed SDL built inside
 * {@link buildPlacementScreeningRequest} — never the deployment SDL, so the real deployment still
 * requires a real image.
 */
function fillPlaceholderImages(parsedSdl: SDLInput): void {
  const services = (parsedSdl as { services?: Record<string, { image?: string }> }).services;
  if (!services) return;
  for (const service of Object.values(services)) {
    if (!service.image) {
      service.image = SCREENING_PLACEHOLDER_IMAGE;
    }
  }
}
