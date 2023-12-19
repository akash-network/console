"use client";
import React from "react";
import Link from "next/link";
import { bytesToShrink } from "@/lib/unitUtils";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UrlService } from "@/lib/urlUtils";
import { LeaseSpecDetail } from "@/components/LeaseSpecDetail";
import { roundDecimal } from "@/lib/mathHelpers";
import { DeploymentSummary } from "@/types";

type Props = {
  errors?: string;
  isSimple?: boolean;
  deployment: DeploymentSummary;
};

export const DeploymentRow: React.FunctionComponent<Props> = ({ deployment }) => {
  const _ram = bytesToShrink(deployment.memoryQuantity);
  const _storage = bytesToShrink(deployment.storageQuantity);

  return (
    <TableRow>
      <TableCell>
        <Link href={UrlService.publicDeploymentDetails(deployment.owner, deployment.dseq)} target="_blank">
          {deployment.dseq}
        </Link>
      </TableCell>
      <TableCell align="center">
        {/* <Badge
          label={deployment.status}
          size="small"
          color={getStatusColor(deployment.status)}
          sx={{ height: "1rem", fontSize: ".75rem", maxWidth: "120px" }}
        /> */}

        <Badge className="h-4 max-w-[120px] bg-red-400" color={getStatusColor(deployment.status)}>
          {deployment.status}
        </Badge>
      </TableCell>
      <TableCell align="center">
        <Link href={UrlService.block(deployment.createdHeight)} target="_blank">
          {deployment.createdHeight}
        </Link>
      </TableCell>
      <TableCell>
        <LeaseSpecDetail
          className="min-w[120px] mr-1 inline-flex"
          // sx={{ display: "inline-flex", minWidth: "120px", marginRight: 1 }}
          iconSize="small"
          type="cpu"
          value={deployment.cpuUnits / 1_000}
        />
        {!!deployment.gpuUnits && <LeaseSpecDetail className="min-w[120px] mr-1 inline-flex" iconSize="small" type="gpu" value={deployment.gpuUnits} />}
        <LeaseSpecDetail className="min-w[120px] mr-1 inline-flex" iconSize="small" type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
        <LeaseSpecDetail
          className="min-w[120px] mr-1 inline-flex"
          iconSize="small"
          type="storage"
          value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`}
        />
      </TableCell>
    </TableRow>
  );
};

function getStatusColor(status: string): "default" | "success" {
  switch (status) {
    case "active":
      return "success";
    default:
      return "default";
  }
}
