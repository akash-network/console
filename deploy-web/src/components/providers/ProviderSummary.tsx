import { Box, Paper, Typography } from "@mui/material";
import { AuditorButton } from "./AuditorButton";
import { makeStyles } from "tss-react/mui";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { cx } from "@emotion/css";
import { Address } from "../shared/Address";
import { StatusPill } from "../shared/StatusPill";
import { FavoriteButton } from "../shared/FavoriteButton";
import { ApiProviderList, ClientProviderDetailWithStatus } from "@src/types/provider";
import { ProviderMap } from "../../app/providers/ProviderMap";
import { LabelValue } from "../shared/LabelValue";
import { Uptime } from "./Uptime";

const useStyles = makeStyles()(theme => ({
  root: {
    overflow: "hidden"
  }
}));

type Props = {
  provider: Partial<ClientProviderDetailWithStatus>;
};

export const ProviderSummary: React.FunctionComponent<Props> = ({ provider }) => {
  const { classes } = useStyles();
  const { favoriteProviders, updateFavoriteProviders } = useLocalNotes();
  const isFavorite = favoriteProviders.some(x => provider.owner === x);

  const onStarClick = event => {
    event.preventDefault();
    event.stopPropagation();

    const newFavorites = isFavorite ? favoriteProviders.filter(x => x !== provider.owner) : favoriteProviders.concat([provider.owner]);

    updateFavoriteProviders(newFavorites);
  };

  return (
    <Paper elevation={1} className={cx(classes.root)}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" } }}>
        <Box
          sx={{
            padding: "1rem",
            flexGrow: 1
          }}
        >
          <LabelValue label="Name" value={provider.name} />
          <LabelValue label="Uri" value={provider.hostUri} />
          <LabelValue label="Address" value={<Address address={provider.owner} isCopyable />} />
          <LabelValue label="Region" value={provider.ipRegion && provider.ipCountry && `${provider.ipRegion}, ${provider.ipCountry}`} />
          <LabelValue label="Active leases" value={provider.leaseCount} />
          <LabelValue
            label="Your active leases"
            value={
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {provider.userActiveLeases || 0} {provider.userActiveLeases > 0 && <StatusPill state="active" size="medium" />}
              </Box>
            }
          />
          <LabelValue label="Up time (7d)" value={provider.isOnline && <Uptime value={provider.uptime7d} />} />

          <LabelValue label="Favorite" value={<FavoriteButton isFavorite={isFavorite} onClick={onStarClick} />} />
          <LabelValue
            label="Audited"
            value={
              provider.isAudited ? (
                <div>
                  <Typography variant="caption">Yes</Typography>
                  <AuditorButton provider={provider} />
                </div>
              ) : (
                <Typography variant="caption">No</Typography>
              )
            }
          />
        </Box>
        {provider.isOnline && (
          <Box sx={{ flexShrink: 0, flexBasis: { xs: "100%", lg: "45%" }, height: "100%" }}>
            <ProviderMap
              providers={[provider as ApiProviderList]}
              initialZoom={5}
              initialCoordinates={[parseFloat(provider.ipLon), parseFloat(provider.ipLat)]}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
};
