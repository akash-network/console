import { Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { StatusPill } from "../shared/StatusPill";

const useStyles = makeStyles()(theme => ({
  leaseChip: {
    height: "auto",
    marginLeft: ".5rem",
    fontSize: ".7rem",
    padding: "1px"
  },
  chipLabel: {
    dispaly: "flex",
    alignItems: "center",
    flexWrap: "wrap"
  }
}));

export const LeaseChip = ({ lease, providers }) => {
  const { classes } = useStyles();
  const [providerName, setProviderName] = useState(null);

  useEffect(() => {
    const providerInfo = providers?.find(p => p.owner === lease?.provider);

    if (providerInfo) {
      const providerUri = new URL(providerInfo.host_uri);
      setProviderName(providerUri.hostname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  return (
    <Chip
      key={lease.id}
      size="small"
      className={classes.leaseChip}
      classes={{ label: classes.chipLabel }}
      label={<>{providerName && <strong>{providerName}</strong>}</>}
      icon={<StatusPill state={lease.state} size="small" />}
    />
  );
};
