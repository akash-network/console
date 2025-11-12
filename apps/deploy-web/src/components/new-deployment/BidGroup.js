"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidGroup = void 0;
var react_1 = require("react");
var web_1 = require("@akashnetwork/chain-sdk/web");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var networkStore_1 = require("@src/store/networkStore");
var deploymentDetailUtils_1 = require("@src/utils/deploymentDetailUtils");
var FormPaper_1 = require("../sdl/FormPaper");
var LabelValueOld_1 = require("../shared/LabelValueOld");
var SpecDetail_1 = require("../shared/SpecDetail");
var BidRow_1 = require("./BidRow/BidRow");
var BidGroup = function (_a) {
    var bids = _a.bids, gseq = _a.gseq, selectedBid = _a.selectedBid, handleBidSelected = _a.handleBidSelected, disabled = _a.disabled, providers = _a.providers, filteredBids = _a.filteredBids, deploymentDetail = _a.deploymentDetail, isFilteringFavorites = _a.isFilteringFavorites, isFilteringAudited = _a.isFilteringAudited, groupIndex = _a.groupIndex, totalBids = _a.totalBids, isSendingManifest = _a.isSendingManifest;
    var _b = (0, react_1.useState)(null), resources = _b[0], setResources = _b[1];
    var fBids = bids.filter(function (bid) { return filteredBids.includes(bid.id); });
    var selectedNetworkId = networkStore_1.default.useSelectedNetworkId();
    (0, react_1.useEffect)(function () {
        var currentGroup = deploymentDetail === null || deploymentDetail === void 0 ? void 0 : deploymentDetail.groups.find(function (g) { return g.id.gseq === gseq; });
        if (currentGroup) {
            var resourcesSum = {
                cpuAmount: (0, deploymentDetailUtils_1.deploymentGroupResourceSum)(currentGroup, function (r) { return parseInt(r.cpu.units.val) / 1000; }),
                gpuAmount: (0, deploymentDetailUtils_1.deploymentGroupResourceSum)(currentGroup, function (r) { var _a, _b; return parseInt(((_b = (_a = r.gpu) === null || _a === void 0 ? void 0 : _a.units) === null || _b === void 0 ? void 0 : _b.val) || "0"); }),
                memoryAmount: (0, deploymentDetailUtils_1.deploymentGroupResourceSum)(currentGroup, function (r) { return parseInt(r.memory.quantity.val); }),
                storageAmount: (0, deploymentDetailUtils_1.deploymentGroupResourceSum)(currentGroup, function (r) { return (0, deploymentDetailUtils_1.getStorageAmount)(r); })
            };
            setResources(resourcesSum);
        }
    }, [deploymentDetail, gseq]);
    return (<FormPaper_1.FormPaper className="mb-4 rounded-none" contentClassName="p-0">
      <div className="sticky top-0 z-[100] -mt-1 flex items-center justify-between border-b border-t bg-popover px-4 py-2 leading-8">
        <div className="flex items-center">
          <h6 className="text-xs">
            <LabelValueOld_1.LabelValueOld label="GSEQ:" value={gseq}/>
          </h6>

          {resources && (<div className="ml-4">
              <SpecDetail_1.SpecDetail cpuAmount={resources.cpuAmount} memoryAmount={resources.memoryAmount} storageAmount={resources.storageAmount} gpuAmount={resources.gpuAmount} color="secondary" size="small"/>
            </div>)}
        </div>

        <div className="flex items-center">
          {!!selectedBid && <iconoir_react_1.Check className="text-primary"/>}
          <div className="ml-4">
            {groupIndex + 1} of {totalBids}
          </div>
        </div>
      </div>

      <components_1.Table>
        <components_1.TableHeader>
          <components_1.TableRow>
            <components_1.TableCell width="10%" align="center">
              Price
            </components_1.TableCell>
            <components_1.TableCell width="10%" align="center">
              Region
            </components_1.TableCell>
            <components_1.TableCell width="10%" align="center">
              Uptime (7d)
            </components_1.TableCell>
            <components_1.TableCell width="20%" align="center">
              Provider
            </components_1.TableCell>
            {((deploymentDetail === null || deploymentDetail === void 0 ? void 0 : deploymentDetail.gpuAmount) || 0) > 0 && (<components_1.TableCell width="10%" align="center">
                GPU
              </components_1.TableCell>)}
            <components_1.TableCell width="5%" align="center">
              Audited
            </components_1.TableCell>
            <components_1.TableCell width="5%" align="center">
              <strong>Select</strong>
            </components_1.TableCell>
          </components_1.TableRow>
        </components_1.TableHeader>

        <components_1.TableBody>
          {fBids.map(function (bid) {
            var provider = providers && providers.find(function (x) { return x.owner === bid.provider; });
            var showBid = (provider === null || provider === void 0 ? void 0 : provider.isValidVersion) && (!isSendingManifest || (selectedBid === null || selectedBid === void 0 ? void 0 : selectedBid.id) === bid.id);
            return (showBid && provider) || selectedNetworkId !== web_1.MAINNET_ID ? (<BidRow_1.BidRow key={bid.id} bid={bid} provider={provider} handleBidSelected={handleBidSelected} disabled={disabled} selectedBid={selectedBid} isSendingManifest={isSendingManifest}/>) : null;
        })}
        </components_1.TableBody>
      </components_1.Table>

      {isFilteringFavorites && fBids.length === 0 && (<div className="px-4 py-2">
          <components_1.Alert>
            <span className="text-sm text-muted-foreground">There are no favorite providers for this group...</span>
          </components_1.Alert>
        </div>)}

      {isFilteringAudited && fBids.length === 0 && (<div className="px-4 py-2">
          <components_1.Alert>
            <span className="text-sm text-muted-foreground">
              There are no audited providers for this group... Try unchecking the "Audited" flag or clearing the search.
            </span>
          </components_1.Alert>
        </div>)}
    </FormPaper_1.FormPaper>);
};
exports.BidGroup = BidGroup;
