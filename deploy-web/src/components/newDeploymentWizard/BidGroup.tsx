"use client";
import { useEffect, useState } from "react";
import { BidRow } from "./BidRow";
import { deploymentGroupResourceSum, getStorageAmount } from "@src/utils/deploymentDetailUtils";
import { LabelValueOld } from "../shared/LabelValueOld";
import { SpecDetail } from "../shared/SpecDetail";
import { CustomTableHeader } from "../shared/CustomTable";
import { BidDto, DeploymentDto } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { useSettings } from "@src/context/SettingsProvider";
import { mainnetId } from "@src/utils/constants";
import { FormPaper } from "../sdl/FormPaper";
import { Alert } from "../ui/alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import { Check } from "iconoir-react";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     marginBottom: "1rem"
//   },
//   subHeader: {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingBottom: "6px",
//     paddingTop: "6px",
//     zIndex: 100,
//     lineHeight: "2rem",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
//   },
//   secondaryText: {
//     fontSize: ".8rem"
//   },
//   attributesContainer: {
//     flexBasis: "45%",
//     margin: "2px 0",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : "rgba(0,0,0,0.05)",
//     borderRadius: ".5rem",
//     padding: ".5rem"
//   },
//   attributeTitle: {
//     marginBottom: "2px"
//   },
//   attributeRow: {
//     display: "flex",
//     alignItems: "center",
//     lineHeight: "1rem"
//   },
//   attributeText: {
//     lineHeight: "1rem",
//     letterSpacing: 0
//   },
//   chip: {
//     height: "16px"
//   },
//   priceTooltip: {
//     display: "flex",
//     alignItems: "center",
//     color: theme.palette.grey[600]
//   }
// }));

type Props = {
  bids: Array<BidDto>;
  gseq: number;
  selectedBid: BidDto;
  handleBidSelected: (bid: BidDto) => void;
  disabled: boolean;
  providers: ApiProviderList[];
  filteredBids: string[];
  deploymentDetail: DeploymentDto;
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
  const allBidsClosed = bids.every(b => b.state === "closed");
  const fBids = bids.filter(bid => filteredBids.includes(bid.id));
  const { selectedNetworkId } = useSettings();

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
    <FormPaper className="mb-4">
      <List
        subheader={
          <ListSubheader component="div" className={classes.subHeader}>
            <div className="flex items-center">
              <h6>
                <LabelValueOld label="GSEQ:" value={gseq} />
              </h6>

              {resources && (
                <div className="ml-2">
                  <SpecDetail
                    cpuAmount={resources.cpuAmount}
                    memoryAmount={resources.memoryAmount}
                    storageAmount={resources.storageAmount}
                    gpuAmount={resources.gpuAmount}
                    color={allBidsClosed ? "default" : "primary"}
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
          </ListSubheader>
        }
      >
        <ListItem>
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
                return (showBid || selectedNetworkId !== mainnetId) && provider ? (
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
        </ListItem>

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
      </List>
    </FormPaper>
  );
};
