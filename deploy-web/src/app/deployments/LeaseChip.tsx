"use client";
import { useEffect, useState } from "react";
import { StatusPill } from "../../components/shared/StatusPill";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { LeaseDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { Badge } from "../../components/ui/badge";

// const useStyles = makeStyles()(theme => ({
//   leaseChip: {
//     height: "auto",
//     marginLeft: ".5rem",
//     fontSize: ".7rem",
//     padding: "1px",
//     cursor: "inherit",
//     textDecoration: "inherit"
//   },
//   chipLabel: {
//     dispaly: "flex",
//     alignItems: "center",
//     flexWrap: "wrap"
//   }
// }));

type Props = {
  lease: LeaseDto;
  providers: ApiProviderList[] | undefined;
};

export const LeaseChip: React.FunctionComponent<Props> = ({ lease, providers }) => {
  const [providerName, setProviderName] = useState<string | null>(null);

  useEffect(() => {
    const provider = providers?.find(p => p.owner === lease?.provider);

    if (provider) {
      setProviderName(provider.name);
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
      <Badge
      // className={classes.leaseChip}
      // classes={{ label: classes.chipLabel }}
      >
        <strong>{providerName}</strong>
        <StatusPill state={lease.state} size="small" />
      </Badge>
    </Link>
  );
};
