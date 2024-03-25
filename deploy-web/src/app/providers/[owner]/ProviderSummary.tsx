"use client";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { ApiProviderList, ClientProviderDetailWithStatus } from "@src/types/provider";
import { ProviderMap } from "../ProviderMap";
import { Card, CardContent } from "@src/components/ui/card";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Address } from "@src/components/shared/Address";
import { StatusPill } from "@src/components/shared/StatusPill";
import { Uptime } from "@src/components/providers/Uptime";
import { FavoriteButton } from "@src/components/shared/FavoriteButton";
import { AuditorButton } from "@src/components/providers/AuditorButton";

type Props = {
  provider: ClientProviderDetailWithStatus;
};

export const ProviderSummary: React.FunctionComponent<Props> = ({ provider }) => {
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);

  const onStarClick = event => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner as string]);

    updateFavoriteProviders(newFavorites);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent>
        <div className="flex flex-col lg:flex-row">
          <div className="flex-grow-1 p-4">
            <LabelValue label="Name" value={provider.name} />
            <LabelValue label="Uri" value={provider.hostUri} />
            <LabelValue label="Address" value={<Address address={provider.owner as string} isCopyable />} />
            <LabelValue label="Region" value={provider.ipRegion && provider.ipCountry && `${provider.ipRegion}, ${provider.ipCountry}`} />
            <LabelValue label="Active leases" value={provider.leaseCount} />
            <LabelValue
              label="Your active leases"
              value={
                <div className="flex items-center">
                  {provider.userActiveLeases || 0} {(provider.userActiveLeases || 0) > 0 && <StatusPill state="active" size="medium" />}
                </div>
              }
            />
            <LabelValue label="Up time (7d)" value={provider.isOnline && <Uptime value={provider.uptime7d} />} />

            <LabelValue label="Favorite" value={<FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />} />
            <LabelValue
              label="Audited"
              value={
                provider.isAudited ? (
                  <div>
                    <span className="text-sm text-muted-foreground">Yes</span>
                    <AuditorButton provider={provider} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No</span>
                )
              }
            />
          </div>
          {provider.isOnline && (
            <div className="h-full flex-shrink-0 basis-full lg:basis-1/2">
              <ProviderMap
                providers={[provider as ApiProviderList]}
                initialZoom={5}
                initialCoordinates={[parseFloat(provider.ipLon), parseFloat(provider.ipLat)]}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
