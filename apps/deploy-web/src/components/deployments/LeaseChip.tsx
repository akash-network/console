"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

import { getSplitText } from "@src/hooks/useShortText";
import { LeaseDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { StatusPill } from "../shared/StatusPill";
import { Badge } from "../ui/badge";

type Props = {
  lease: LeaseDto;
  providers: ApiProviderList[] | undefined;
};

export const LeaseChip: React.FunctionComponent<Props> = ({ lease, providers }) => {
  const [providerName, setProviderName] = useState<string>("");

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
      <Badge variant="outline" className="whitespace-nowrap text-xs hover:bg-primary/20">
        <span>
          {providerName?.length > 20 ? (
            <CustomTooltip title={providerName}>
              <div>{getSplitText(providerName, 4, 13)}</div>
            </CustomTooltip>
          ) : (
            providerName
          )}
        </span>
        <StatusPill state={lease.state} size="small" />
      </Badge>
    </Link>
  );
};
