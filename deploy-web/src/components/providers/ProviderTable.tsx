"use client";
import { ClientProviderList } from "@src/types/provider";
import { ProviderListRow } from "./ProviderTableRow";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@src/components/ui/table";
import { cn } from "@src/utils/styleUtils";

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
          <TableHead className="w-[10%]">Location</TableHead>
          <TableHead className="w-[5%]" align="center">
            Uptime (7d)
          </TableHead>
          <TableHead align="left" className={cn("w-[5%]", { ["font-bold"]: isSortingLeases })}>
            Active Leases
          </TableHead>
          <TableHead align="center" className="w-[15%]">
            CPU
          </TableHead>
          <TableHead align="center" className={cn("w-[15%]", { ["font-bold"]: sortOption === "gpu-available-desc" })}>
            GPU
          </TableHead>
          <TableHead align="center" className="w-[15%]">
            Memory
          </TableHead>
          <TableHead align="center" className="w-[15%]">
            Disk
          </TableHead>
          <TableHead align="center" className="w-[5%]">
            Audited
          </TableHead>
          <TableHead align="center" className="w-[5%]">
            Favorite
          </TableHead>
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
