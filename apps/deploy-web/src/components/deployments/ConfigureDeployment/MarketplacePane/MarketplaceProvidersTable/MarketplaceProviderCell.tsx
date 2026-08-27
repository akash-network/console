import type { FC } from "react";
import { CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Badge } from "@akashnetwork/ui/components";
import Link from "next/link";

import { ShortenedValue } from "@src/components/shared/ShortenedValue";
import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { getProviderNameFromUri, providerDisplayName } from "@src/utils/providerUtils";
import { UrlService } from "@src/utils/urlUtils";

/** Host from the provider's URI, or null when it has none (bid-sourced offers) or the URI is malformed. */
function getProviderHost(hostUri?: string | null): string | null {
  const trimmed = hostUri?.trim();
  if (!trimmed) return null;
  try {
    return getProviderNameFromUri(trimmed);
  } catch {
    return null;
  }
}

interface Props {
  offer: PlacementOffer;
  /** Whether the name links to the provider's detail page. */
  showProviderLink: boolean;
  verificationEnabled?: boolean;
}

/**
 * Provider column: shows the display name, linked to the provider's detail page (opened in a new tab so the
 * in-progress deployment isn't lost) when `showProviderLink` allows it. When the name is a moniker (organization), the
 * actual host is shown beneath it — the self-declared name alone doesn't tell you which provider you're really getting.
 */
export const MarketplaceProviderCell: FC<Props> = ({ offer, showProviderLink, verificationEnabled = false }) => {
  const displayName = providerDisplayName(offer);
  const host = getProviderHost(offer.hostUri);
  const subtitle = host && host !== displayName ? host : null;
  const name = <ShortenedValue value={displayName} maxLength={40} headLength={14} />;

  return (
    <div className="flex min-w-0 flex-col">
      {showProviderLink ? (
        <Link
          href={UrlService.providerDetail(offer.owner)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}
          className="min-w-0 truncate font-medium text-primary hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="min-w-0 truncate font-medium">{name}</span>
      )}
      {subtitle && <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{subtitle}</span>}
      {verificationEnabled && offer.verification && <VerificationFacts verification={offer.verification} />}
    </div>
  );
};

function VerificationFacts({ verification }: { verification: NonNullable<PlacementOffer["verification"]> }) {
  if (verification.outcome === "not_evaluated") {
    return (
      <div className="mt-1">
        <Badge variant="outline" className="px-1.5 py-0 text-xs font-normal">
          Verification not evaluated
        </Badge>
      </div>
    );
  }

  const { summary } = verification;
  const auditorCount = summary.validAuditors.length;
  const capabilities = summary.capabilities.map(formatCapability).filter(Boolean);

  return (
    <div className="mt-1 space-y-0.5 text-xs font-normal text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="px-1.5 py-0 text-xs font-normal">
          Auditor-attested {formatTier(summary.tierGateTier)}
        </Badge>
        <span>
          {auditorCount} {auditorCount === 1 ? "auditor" : "auditors"}
        </span>
      </div>
      {capabilities.length > 0 && <p>{capabilities.join(", ")}</p>}
      <p>Provider-signed inventory: {summary.snapshotState.replace("_", " ")}</p>
    </div>
  );
}

function formatTier(tier: number): string {
  switch (tier) {
    case VerificationTier.verification_tier_identified:
      return "L1";
    case VerificationTier.verification_tier_verified:
      return "L2";
    case VerificationTier.verification_tier_established:
      return "L3";
    case VerificationTier.verification_tier_trusted:
      return "L4";
    default:
      return "L0";
  }
}

function formatCapability(capability: number): string {
  switch (capability) {
    case CapabilityFlag.capability_tee_hardware_attestation:
      return "TEE hardware";
    case CapabilityFlag.capability_confidential_computing:
      return "Confidential computing";
    case CapabilityFlag.capability_persistent_storage:
      return "Persistent storage";
    case CapabilityFlag.capability_bare_metal:
      return "Bare metal";
    default:
      return "";
  }
}
