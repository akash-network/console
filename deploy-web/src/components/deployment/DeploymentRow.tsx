import React from "react";
import TableCell from "@mui/material/TableCell";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentSummary } from "@src/types/deployment";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";
import { Chip } from "@mui/material";
import { CustomTableRow } from "../shared/CustomTable";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";

type Props = {
  errors?: string;
  isSimple?: boolean;
  deployment: DeploymentSummary;
};

export const DeploymentRow: React.FunctionComponent<Props> = ({ deployment }) => {
  const _ram = bytesToShrink(deployment.memoryQuantity);
  const _storage = bytesToShrink(deployment.storageQuantity);

  return (
    <CustomTableRow>
      <TableCell>
        <Link
          href={UrlService.publicDeploymentDetails(deployment.owner, deployment.dseq)}
          target="_blank">
          {deployment.dseq}
        </Link>
      </TableCell>
      <TableCell align="center">
        <Chip label={deployment.status} size="small" color={getStatusColor(deployment.status)} sx={{ height: "1rem", fontSize: ".75rem", maxWidth: "120px" }} />
      </TableCell>
      <TableCell align="center">
        <Link href={UrlService.block(deployment.createdHeight)} target="_blank">
          {deployment.createdHeight}
        </Link>
      </TableCell>
      <TableCell>
        <LeaseSpecDetail sx={{ display: "inline-flex", minWidth: "120px", marginRight: 1 }} iconSize="small" type="cpu" value={deployment.cpuUnits / 1_000} />
        {!!deployment.gpuUnits && (
          <LeaseSpecDetail sx={{ display: "inline-flex", minWidth: "120px", marginRight: 1 }} iconSize="small" type="gpu" value={deployment.gpuUnits} />
        )}
        <LeaseSpecDetail
          sx={{ display: "inline-flex", minWidth: "145px", marginRight: 1 }}
          iconSize="small"
          type="ram"
          value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`}
        />
        <LeaseSpecDetail
          sx={{ display: "inline-flex", minWidth: "145px", marginRight: 1 }}
          iconSize="small"
          type="storage"
          value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`}
        />
      </TableCell>
    </CustomTableRow>
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
