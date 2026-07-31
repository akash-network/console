import type { FC } from "react";
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
}

/**
 * Provider column: shows the display name, linked to the provider's detail page (opened in a new tab so the
 * in-progress deployment isn't lost) when `showProviderLink` allows it. When the name is a moniker (organization), the
 * actual host is shown beneath it — the self-declared name alone doesn't tell you which provider you're really getting.
 */
export const MarketplaceProviderCell: FC<Props> = ({ offer, showProviderLink }) => {
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
    </div>
  );
};
