"use client";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import { ClientProviderList } from "@src/types/provider";
import { cn } from "@src/utils/styleUtils";
import { ProviderListRow } from "./ProviderTableRow";

type Props = {
  providers: Array<ClientProviderList>;
  sortOption: string;
};

export const ProviderTable: React.FunctionComponent<Props> = ({ providers, sortOption }) => {
  const isSortingLeases =
    sortOption === "active-leases-desc" || sortOption === "active-leases-asc" || sortOption === "my-leases-desc" || sortOption === "my-active-leases-desc";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[10%]">Name</TableHead>
          <TableHead className="w-[10%] text-center">Location</TableHead>
          <TableHead className="w-[5%] text-center">Uptime (7d)</TableHead>
          <TableHead className={cn("w-[5%] text-center", { ["font-bold text-primary"]: isSortingLeases })}>Active Leases</TableHead>
          <TableHead className="w-[15%]">CPU</TableHead>
          <TableHead className={cn("w-[15%]", { ["font-bold text-primary"]: sortOption === "gpu-available-desc" })}>GPU</TableHead>
          <TableHead className="w-[15%]">Memory</TableHead>
          <TableHead className="w-[15%]">Disk</TableHead>
          <TableHead className="w-[5%] text-center">Audited</TableHead>
          <TableHead className="w-[5%] text-center">Favorite</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {providers.map(provider => {
          return <ProviderListRow key={provider.owner} provider={provider} />;
        })}
      </TableBody>
    </Table>
  );
};
