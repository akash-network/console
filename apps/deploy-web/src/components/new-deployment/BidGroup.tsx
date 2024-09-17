"use client";
import { useEffect, useState } from "react";
import { MAINNET_ID } from "@akashnetwork/network-store";
import { Alert, Table, TableBody, TableCell, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Check } from "iconoir-react";

import networkStore from "@src/store/networkStore";
import { BidDto, DeploymentDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { deploymentGroupResourceSum, getStorageAmount } from "@src/utils/deploymentDetailUtils";
import { FormPaper } from "../sdl/FormPaper";
import { LabelValueOld } from "../shared/LabelValueOld";
import { SpecDetail } from "../shared/SpecDetail";
import { BidRow } from "./BidRow";

type Props = {
  bids: Array<BidDto>;
  gseq: number;
  selectedBid: BidDto;
  handleBidSelected: (bid: BidDto) => void;
  disabled: boolean;
  providers: ApiProviderList[] | undefined;
  filteredBids: string[];
  deploymentDetail: DeploymentDto | null | undefined;
  isFilteringFavorites: boolean;
  isFilteringAudited: boolean;
  groupIndex: number;
  totalBids: number;
  isSendingManifest: boolean;
};

export const BidGroup: React.FunctionComponent<Props> = ({
  bids,
  gseq,
  selectedBid,
  handleBidSelected,
  disabled,
  providers,
  filteredBids,
  deploymentDetail,
  isFilteringFavorites,
  isFilteringAudited,
  groupIndex,
  totalBids,
  isSendingManifest
}) => {
  const [resources, setResources] = useState<{ cpuAmount: number; gpuAmount: number; memoryAmount: number; storageAmount: number } | null>(null);
  const fBids = bids.filter(bid => filteredBids.includes(bid.id));
  const selectedNetworkId = networkStore.useSelectedNetworkId();

  useEffect(() => {
    const currentGroup = deploymentDetail?.groups.find(g => g.group_id.gseq === gseq);
    if (currentGroup) {
      const resourcesSum = {
        cpuAmount: deploymentGroupResourceSum(currentGroup, r => parseInt(r.cpu.units.val) / 1000),
        gpuAmount: deploymentGroupResourceSum(currentGroup, r => parseInt(r.gpu?.units?.val || 0)),
        memoryAmount: deploymentGroupResourceSum(currentGroup, r => parseInt(r.memory.quantity.val)),
        storageAmount: deploymentGroupResourceSum(currentGroup, r => getStorageAmount(r))
      };
      setResources(resourcesSum);
    }
  }, [deploymentDetail, gseq]);
  return (
    <FormPaper className="mb-4 rounded-none" contentClassName="p-0">
      <div className="sticky top-0 z-[100] -mt-1 flex items-center justify-between border-b border-t bg-popover px-4 py-2 leading-8">
        <div className="flex items-center">
          <h6 className="text-xs">
            <LabelValueOld label="GSEQ:" value={gseq} />
          </h6>

          {resources && (
            <div className="ml-4">
              <SpecDetail
                cpuAmount={resources.cpuAmount}
                memoryAmount={resources.memoryAmount}
                storageAmount={resources.storageAmount}
                gpuAmount={resources.gpuAmount}
                color="secondary"
                size="small"
              />
            </div>
          )}
        </div>

        <div className="flex items-center">
          {!!selectedBid && <Check className="text-primary" />}
          <div className="ml-4">
            {groupIndex + 1} of {totalBids}
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableCell width="10%" align="center">
              Price
            </TableCell>
            <TableCell width="10%" align="center">
              Region
            </TableCell>
            <TableCell width="10%" align="center">
              Uptime (7d)
            </TableCell>
            <TableCell width="10%" align="center">
              Provider
            </TableCell>
            {(deploymentDetail?.gpuAmount || 0) > 0 && (
              <TableCell width="10%" align="center">
                GPU
              </TableCell>
            )}
            <TableCell width="10%" align="center">
              Audited
            </TableCell>
            <TableCell width="10%" align="center">
              <strong>Select</strong>
            </TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {fBids.map(bid => {
            const provider = providers && providers.find(x => x.owner === bid.provider);
            const showBid = provider?.isValidVersion && (!isSendingManifest || selectedBid?.id === bid.id);
            return (showBid || selectedNetworkId !== MAINNET_ID) && provider ? (
              <BidRow
                key={bid.id}
                bid={bid}
                provider={provider}
                handleBidSelected={handleBidSelected}
                disabled={disabled}
                selectedBid={selectedBid}
                isSendingManifest={isSendingManifest}
              />
            ) : null;
          })}
        </TableBody>
      </Table>

      {isFilteringFavorites && fBids.length === 0 && (
        <div className="px-4 py-2">
          <Alert>
            <span className="text-sm text-muted-foreground">There are no favorite providers for this group...</span>
          </Alert>
        </div>
      )}

      {isFilteringAudited && fBids.length === 0 && (
        <div className="px-4 py-2">
          <Alert>
            <span className="text-sm text-muted-foreground">
              There are no audited providers for this group... Try unchecking the "Audited" flag or clearing the search.
            </span>
          </Alert>
        </div>
      )}
    </FormPaper>
  );
};
