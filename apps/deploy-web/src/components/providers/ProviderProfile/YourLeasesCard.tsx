import type { FC } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import type { LeaseDto } from "@src/types/deployment";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ProfileCard } from "./ProfileCard";

export const DEPENDENCIES = { PricePerTimeUnit };

type Props = {
  leases: LeaseDto[];
  getDeploymentName: (dseq: string) => string | null;
  dependencies?: typeof DEPENDENCIES;
};

export const YourLeasesCard: FC<Props> = ({ leases, getDeploymentName, dependencies: d = DEPENDENCIES }) => (
  <ProfileCard
    title="Your leases here"
    aside={<span className="font-mono text-[11px] text-muted-foreground">{leases.length === 1 ? "1 active" : `${leases.length} active`}</span>}
    className="border-foreground/25"
  >
    <ul className="px-3.5 pb-2.5 pt-1">
      {leases.map(lease => (
        <li key={lease.id} className="border-t first:border-t-0">
          <Link href={UrlService.deploymentDetails(lease.dseq)} className="flex items-center gap-[9px] py-[9px] hover:opacity-80">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-foreground">{getDeploymentName(lease.dseq) ?? `Deployment ${lease.dseq}`}</span>
              <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">dseq {lease.dseq}</span>
            </span>
            <d.PricePerTimeUnit
              denom={lease.price.denom}
              perBlockValue={uaktToAKT(parseFloat(lease.price.amount), 10)}
              showAsHourly={(lease.gpuAmount ?? 0) > 0}
              abbreviated
              className="whitespace-nowrap font-mono text-[11.5px] text-foreground"
            />
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  </ProfileCard>
);
