"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeGrantTable = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var LinkTo_1 = require("../shared/LinkTo");
var AllowanceIssuedRow_1 = require("./AllowanceIssuedRow");
var FeeGrantTable = function (_a) {
    var allowances = _a.allowances, selectedAllowances = _a.selectedAllowances, onEditAllowance = _a.onEditAllowance, setDeletingAllowances = _a.setDeletingAllowances, setSelectedAllowances = _a.setSelectedAllowances, pageIndex = _a.pageIndex, pageSize = _a.pageSize, totalCount = _a.totalCount, onPageChange = _a.onPageChange;
    var pageCount = Math.ceil(totalCount / pageSize);
    var onSelectGrant = function (checked, grant) {
        setSelectedAllowances(function (prev) {
            return checked ? prev.concat([grant]) : prev.filter(function (x) { return x.grantee !== grant.grantee; });
        });
    };
    var onGrantDelete = function (grant) {
        setDeletingAllowances([grant]);
    };
    var onDeleteGrants = function () {
        setDeletingAllowances(selectedAllowances);
    };
    var onDeleteAll = function () {
        setDeletingAllowances(allowances);
    };
    var onClearSelection = function () {
        setSelectedAllowances([]);
    };
    var handleChangePage = function (newPage) {
        onPageChange(newPage, pageSize);
    };
    var onPageSizeChange = function (value) {
        onPageChange(0, value);
    };
    return (<div>
      <components_1.Table aria-label="Tx Fee Authorization List">
        <components_1.TableHeader>
          <components_1.TableRow>
            <components_1.TableHead className="w-1/5">Type</components_1.TableHead>
            <components_1.TableHead className="w-1/5 text-center">Grantee</components_1.TableHead>
            <components_1.TableHead className="w-1/5 text-center">Spending Limit</components_1.TableHead>
            <components_1.TableHead className="w-1/5 text-center">Expiration</components_1.TableHead>
            <components_1.TableHead className="w-1/5 text-center">
              {selectedAllowances.length > 0 && (<div className="flex items-center justify-end space-x-4">
                  <LinkTo_1.LinkTo onClick={onClearSelection} className="text-xs">
                    Clear
                  </LinkTo_1.LinkTo>
                  <components_1.Button onClick={onDeleteGrants} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                    Revoke selected ({selectedAllowances.length})
                  </components_1.Button>
                </div>)}
              {allowances.length > 0 && selectedAllowances.length === 0 && (<div className="flex items-center justify-end">
                  <components_1.Button onClick={onDeleteAll} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                    Revoke all
                  </components_1.Button>
                </div>)}
            </components_1.TableHead>
          </components_1.TableRow>
        </components_1.TableHeader>

        <components_1.TableBody>
          {allowances.map(function (grant) { return (<AllowanceIssuedRow_1.AllowanceIssuedRow key={grant.grantee} allowance={grant} onEditAllowance={onEditAllowance} setDeletingAllowance={onGrantDelete} onSelectAllowance={onSelectGrant} checked={selectedAllowances.some(function (x) { return x.grantee === grant.grantee && x.granter === grant.granter; })}/>); })}
        </components_1.TableBody>
      </components_1.Table>

      {pageCount > 1 && (<div className="flex items-center justify-center pt-6">
          <components_1.CustomPagination totalPageCount={pageCount} setPageIndex={handleChangePage} pageIndex={pageIndex} pageSize={pageSize} setPageSize={onPageSizeChange}/>
        </div>)}
    </div>);
};
exports.FeeGrantTable = FeeGrantTable;
