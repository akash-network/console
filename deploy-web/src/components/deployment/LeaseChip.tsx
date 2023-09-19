import { Chip } from "@mui/material";
import { useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { StatusPill } from "../shared/StatusPill";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { LeaseDto } from "@src/types/deployment";
import { MergedProvider } from "@src/types/provider";

const useStyles = makeStyles()(theme => ({
  leaseChip: {
    height: "auto",
    marginLeft: ".5rem",
    fontSize: ".7rem",
    padding: "1px",
    cursor: "inherit",
    textDecoration: "inherit"
  },
  chipLabel: {
    dispaly: "flex",
    alignItems: "center",
    flexWrap: "wrap"
  }
}));

type Props = {
  lease: LeaseDto;
  providers: MergedProvider[];
};

export const LeaseChip: React.FunctionComponent<Props> = ({ lease, providers }) => {
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
    <Link
      href={UrlService.providerDetail(lease.provider)}
      onClick={event => {
        event.stopPropagation();
      }}
    >
      <Chip
        key={lease.id}
        size="small"
        className={classes.leaseChip}
        classes={{ label: classes.chipLabel }}
        label={<>{providerName && <strong>{providerName}</strong>}</>}
        icon={<StatusPill state={lease.state} size="small" />}
      />
    </Link>
  );
};
