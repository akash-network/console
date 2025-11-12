"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderTable = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ProviderTableRow_1 = require("./ProviderTableRow");
var ProviderTable = function (_a) {
    var _b, _c;
    var providers = _a.providers, sortOption = _a.sortOption;
    var isSortingLeases = sortOption === "active-leases-desc" || sortOption === "active-leases-asc" || sortOption === "my-leases-desc" || sortOption === "my-active-leases-desc";
    return (<components_1.Table>
      <components_1.TableHeader>
        <components_1.TableRow>
          <components_1.TableHead className="w-[10%]">Name</components_1.TableHead>
          <components_1.TableHead className="w-[10%] text-center">Location</components_1.TableHead>
          <components_1.TableHead className="w-[5%] text-center">Uptime (7d)</components_1.TableHead>
          <components_1.TableHead className={(0, utils_1.cn)("w-[5%] text-center", (_b = {}, _b["font-bold text-primary"] = isSortingLeases, _b))}>Active Leases</components_1.TableHead>
          <components_1.TableHead className="w-[15%]">CPU</components_1.TableHead>
          <components_1.TableHead className={(0, utils_1.cn)("w-[15%]", (_c = {}, _c["font-bold text-primary"] = sortOption === "gpu-available-desc", _c))}>GPU</components_1.TableHead>
          <components_1.TableHead className="w-[15%]">Memory</components_1.TableHead>
          <components_1.TableHead className="w-[15%]">Disk</components_1.TableHead>
          <components_1.TableHead className="w-[5%] text-center">Audited</components_1.TableHead>
          <components_1.TableHead className="w-[5%] text-center">Favorite</components_1.TableHead>
        </components_1.TableRow>
      </components_1.TableHeader>

      <components_1.TableBody>
        {providers.map(function (provider) {
            return <ProviderTableRow_1.ProviderListRow key={provider.owner} provider={provider}/>;
        })}
      </components_1.TableBody>
    </components_1.Table>);
};
exports.ProviderTable = ProviderTable;
