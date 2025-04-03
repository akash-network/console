"use client";
import { useEffect, useState } from "react";
import { Badge, Spinner } from "@akashnetwork/ui/components";
import Link from "next/link";

import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import { CopyTextToClipboardButton } from "../copy-text-to-clipboard-button/CopyTextToClipboardButton";
import { StatusPill } from "../shared/StatusPill";
import { ShortenedValue } from "../shortened-value/ShortenedValue";

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
    <div className="flex items-center space-x-2">
      <Link
        href={UrlService.providerDetail(lease.provider)}
        onClick={event => {
          event.stopPropagation();
        }}
      >
        <Badge variant="outline" className="whitespace-nowrap text-xs hover:bg-primary/20">
          {providerName ? <ShortenedValue value={providerName} maxLength={40} headLength={14} /> : <Spinner size="xSmall" />}
          <StatusPill state={lease.state} size="small" />
        </Badge>
      </Link>

      {providerName && <CopyTextToClipboardButton value={providerName} />}
    </div>
  );
};
