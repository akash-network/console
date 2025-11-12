"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentGrantTable = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var logging_1 = require("@akashnetwork/logging");
var components_1 = require("@akashnetwork/ui/components");
var react_table_1 = require("@tanstack/react-table");
var iconoir_react_1 = require("iconoir-react");
var AKTAmount_1 = require("@src/components/shared/AKTAmount");
var priceUtils_1 = require("@src/utils/priceUtils");
var LinkTo_1 = require("../shared/LinkTo");
var logger = logging_1.LoggerService.forContext("DeploymentGrantTable");
var DeploymentGrantTable = function (_a) {
    var grants = _a.grants, totalCount = _a.totalCount, onEditGrant = _a.onEditGrant, onPageChange = _a.onPageChange, setDeletingGrants = _a.setDeletingGrants, setSelectedGrants = _a.setSelectedGrants, selectedGrants = _a.selectedGrants, pageIndex = _a.pageIndex, pageSize = _a.pageSize;
    var selectGrants = function (checked, grant) {
        setSelectedGrants(function (prev) {
            return checked ? prev.concat([grant]) : prev.filter(function (x) { return x.grantee !== grant.grantee; });
        });
    };
    var columnHelper = (0, react_table_1.createColumnHelper)();
    var columns = [
        columnHelper.accessor("grantee", {
            header: function () { return <div>Grantee</div>; },
            cell: function (info) { return <components_1.Address address={info.getValue()} isCopyable/>; }
        }),
        columnHelper.accessor(function (row) {
            return row.authorization.spend_limit;
        }, {
            id: "spendingLimit",
            cell: function (info) {
                var value = info.getValue();
                return (<div className="text-center">
              <AKTAmount_1.AKTAmount uakt={(0, priceUtils_1.coinToUDenom)(value)}/> {value.denom === "uakt" ? "AKT" : "USDC"}
            </div>);
            },
            header: function () { return <div className="text-center">Spending Limit</div>; }
        }),
        columnHelper.accessor("expiration", {
            header: function () { return <div className="text-center">Expiration</div>; },
            cell: function (info) { return (<div className="text-center">
          <react_intl_1.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={info.getValue()}/>
        </div>); }
        }),
        columnHelper.display({
            id: "actions",
            header: function () { return (<div>
          {selectedGrants.length > 0 && (<div className="flex items-center justify-end space-x-4">
              <LinkTo_1.LinkTo onClick={function () { return setSelectedGrants([]); }} className="text-xs">
                Clear
              </LinkTo_1.LinkTo>
              <components_1.Button onClick={function () { return setDeletingGrants(selectedGrants); }} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                Revoke selected ({selectedGrants.length})
              </components_1.Button>
            </div>)}
          {grants.length > 0 && selectedGrants.length === 0 && (<div className="flex items-center justify-end">
              <components_1.Button onClick={function () { return setDeletingGrants(grants); }} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                Revoke all
              </components_1.Button>
            </div>)}
        </div>); },
            cell: function (info) {
                var grant = info.row.original;
                return (<div className="flex items-center justify-end space-x-2">
            <div className="flex w-[40px] items-center justify-center">
              <components_1.Checkbox checked={selectedGrants.some(function (x) { return x.grantee === grant.grantee && x.granter === grant.granter; })} onClick={function (event) {
                        event.stopPropagation();
                    }} onCheckedChange={function (value) {
                        if (value !== "indeterminate") {
                            selectGrants(value, grant);
                        }
                        else {
                            logger.warn("Unable to determinate checked state");
                        }
                    }}/>
            </div>
            <components_1.Button variant="ghost" size="icon" onClick={function () { return onEditGrant(grant); }} aria-label="Edit Authorization">
              <iconoir_react_1.Edit className="text-xs"/>
            </components_1.Button>
            <components_1.Button variant="ghost" size="icon" onClick={function () { return setDeletingGrants([grant]); }} aria-label="Revoke Authorization">
              <iconoir_react_1.Bin className="text-xs"/>
            </components_1.Button>
          </div>);
            }
        })
    ];
    var table = (0, react_table_1.useReactTable)({
        data: grants,
        columns: columns,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        getPaginationRowModel: (0, react_table_1.getPaginationRowModel)(),
        manualPagination: true,
        onPaginationChange: function (updaterOrValue) {
            var pagination = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue;
            onPageChange(pagination.pageIndex, pagination.pageSize);
        },
        state: {
            pagination: {
                pageIndex: pageIndex,
                pageSize: pageSize
            }
        }
    });
    var pagination = table.getState().pagination;
    var pageCount = Math.ceil(totalCount / pagination.pageSize);
    return (<div>
      <components_1.Table aria-label="Deployment Authorization List">
        <components_1.TableHeader>
          {table.getHeaderGroups().map(function (headerGroup) { return (<components_1.TableRow key={headerGroup.id}>
              {headerGroup.headers.map(function (header) { return (<components_1.TableHead key={header.id} className="w-1/4">
                  {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                </components_1.TableHead>); })}
            </components_1.TableRow>); })}
        </components_1.TableHeader>

        <components_1.TableBody>
          {table.getRowModel().rows.map(function (row) { return (<components_1.TableRow key={row.id} className="[&>td]:px-2 [&>td]:py-1">
              {row.getVisibleCells().map(function (cell) { return (<components_1.TableCell key={cell.id}>{(0, react_table_1.flexRender)(cell.column.columnDef.cell, cell.getContext())}</components_1.TableCell>); })}
            </components_1.TableRow>); })}
        </components_1.TableBody>
      </components_1.Table>

      {pageCount > components_1.MIN_PAGE_SIZE && (<div className="flex items-center justify-center pt-6">
          <components_1.CustomPagination totalPageCount={pageCount} setPageIndex={table.setPageIndex} pageIndex={pagination.pageIndex} pageSize={pagination.pageSize} setPageSize={table.setPageSize}/>
        </div>)}
    </div>);
};
exports.DeploymentGrantTable = DeploymentGrantTable;
