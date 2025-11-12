"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseRow = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var isEqual_1 = require("lodash/isEqual");
var link_1 = require("next/link");
var PriceEstimateTooltip_1 = require("@src/components/shared/PriceEstimateTooltip");
var PricePerMonth_1 = require("@src/components/shared/PricePerMonth");
var StatusPill_1 = require("@src/components/shared/StatusPill");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var priceUtils_1 = require("@src/utils/priceUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var MemoLeaseRow = function (_a) {
    var lease = _a.lease;
    var getDeploymentName = (0, LocalNoteProvider_1.useLocalNotes)().getDeploymentName;
    var deploymentName = getDeploymentName(lease.dseq);
    return (<components_1.TableRow>
      <components_1.TableCell>
        <StatusPill_1.StatusPill state={lease.state} size="small"/>
      </components_1.TableCell>
      <components_1.TableCell>
        <link_1.default href={urlUtils_1.UrlService.deploymentDetails(lease.dseq)} passHref>
          {lease.dseq}
          {deploymentName && <span className="font-normal"> - {deploymentName}</span>}
        </link_1.default>
      </components_1.TableCell>
      <components_1.TableCell>
        <div className="flex items-center">
          <PricePerMonth_1.PricePerMonth denom={lease.price.denom} perBlockValue={(0, priceUtils_1.uaktToAKT)(parseFloat(lease.price.amount), 10)}/>
          <PriceEstimateTooltip_1.PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount}/>
        </div>
      </components_1.TableCell>
    </components_1.TableRow>);
};
exports.LeaseRow = react_1.default.memo(MemoLeaseRow, function (prevProps, nextProps) {
    return (0, isEqual_1.default)(prevProps, nextProps);
});
