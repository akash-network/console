"use strict";
"use client";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var isEqual_1 = require("lodash/isEqual");
var LeaseRow_1 = require("./LeaseRow");
var MemoLeaseList = function (_a) {
    var leases = _a.leases, isLoadingLeases = _a.isLoadingLeases;
    var _b = (0, react_1.useState)(0), pageIndex = _b[0], setPageIndex = _b[1];
    var _c = (0, react_1.useState)(leases || []), filteredLeases = _c[0], setFilteredLeases = _c[1];
    var _d = (0, react_1.useState)(false), isFilteringActive = _d[0], setIsFilteringActive = _d[1];
    var _e = (0, react_1.useState)(10), pageSize = _e[0], setPageSize = _e[1];
    var start = pageIndex * pageSize;
    var end = start + pageSize;
    var currentPageLeases = filteredLeases.slice(start, end);
    var pageCount = Math.ceil(filteredLeases.length / pageSize);
    (0, react_1.useEffect)(function () {
        if (leases) {
            var _filteredLeases = __spreadArray([], leases, true).sort(function (a) { return (a.state === "active" ? -1 : 1); });
            if (isFilteringActive) {
                _filteredLeases = _filteredLeases.filter(function (x) { return x.state === "active"; });
            }
            setFilteredLeases(_filteredLeases);
        }
    }, [leases, isFilteringActive]);
    var onIsActiveChange = function (value) {
        setPageIndex(0);
        setIsFilteringActive(value);
    };
    var onPageSizeChange = function (value) {
        setPageSize(value);
        setPageIndex(0);
    };
    return (<>
      <div className="flex items-center pb-2">
        <h5 className="text-xl">Your leases</h5>

        <div className="ml-4">
          <components_1.CheckboxWithLabel checked={isFilteringActive} onCheckedChange={onIsActiveChange} label="Active"/>
        </div>
      </div>

      {(currentPageLeases === null || currentPageLeases === void 0 ? void 0 : currentPageLeases.length) === 0 && isLoadingLeases && (<div className="flex items-center justify-center">
          <components_1.Spinner size="large"/>
        </div>)}

      {(currentPageLeases === null || currentPageLeases === void 0 ? void 0 : currentPageLeases.length) === 0 && !isLoadingLeases && <p>You have 0 {isFilteringActive ? "active" : ""} lease for this provider.</p>}

      {(currentPageLeases === null || currentPageLeases === void 0 ? void 0 : currentPageLeases.length) > 0 && (<>
          <components_1.Table>
            <components_1.TableHeader>
              <components_1.TableRow>
                <components_1.TableHead>Status</components_1.TableHead>
                <components_1.TableHead>Dseq</components_1.TableHead>
                <components_1.TableHead>Price</components_1.TableHead>
              </components_1.TableRow>
            </components_1.TableHeader>

            <components_1.TableBody>
              {currentPageLeases.map(function (lease) { return (<LeaseRow_1.LeaseRow key={lease.id} lease={lease}/>); })}
            </components_1.TableBody>
          </components_1.Table>

          <div className="flex items-center justify-center py-8">
            <components_1.CustomPagination pageSize={pageSize} setPageIndex={setPageIndex} pageIndex={pageIndex} totalPageCount={pageCount} setPageSize={onPageSizeChange}/>
          </div>
        </>)}
    </>);
};
exports.LeaseList = react_1.default.memo(MemoLeaseList, function (prevProps, nextProps) {
    return (0, isEqual_1.default)(prevProps, nextProps);
});
