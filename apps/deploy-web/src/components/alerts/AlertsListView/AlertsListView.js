"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsListView = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_table_1 = require("@tanstack/react-table");
var lodash_1 = require("lodash");
var link_1 = require("next/link");
var AlertStatus_1 = require("@src/components/alerts/AlertStatus/AlertStatus");
var useFlag_1 = require("@src/hooks/useFlag");
var urlUtils_1 = require("@src/utils/urlUtils");
var DEPENDENCIES = {
    useFlag: useFlag_1.useFlag
};
var AlertsListView = function (_a) {
    var data = _a.data, pagination = _a.pagination, onPaginationChange = _a.onPaginationChange, isLoading = _a.isLoading, onToggle = _a.onToggle, loadingIds = _a.loadingIds, isError = _a.isError, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var columnHelper = (0, react_table_1.createColumnHelper)();
    var isAlertUpdateEnabled = d.useFlag("notifications_general_alerts_update");
    var columns = [
        columnHelper.accessor("enabled", {
            header: "Enabled",
            cell: function (info) {
                var isToggling = loadingIds.has(info.row.original.id);
                return (<div className="flex items-center">
            <components_1.Checkbox checked={info.getValue()} disabled={isToggling} onCheckedChange={function (checked) {
                        var _a;
                        onToggle(info.row.original.id, !!checked, (_a = info.row.original.params) === null || _a === void 0 ? void 0 : _a.dseq);
                    }} aria-label={"Toggle alert"}/>
          </div>);
            }
        }),
        columnHelper.accessor("deploymentName", {
            header: "Deployment Name",
            cell: function (info) {
                var _a;
                return ((_a = info.row.original.params) === null || _a === void 0 ? void 0 : _a.dseq) ? (<link_1.default href={urlUtils_1.UrlService.deploymentDetails(info.row.original.params.dseq, "ALERTS")} className="font-bold">
            {info.getValue()}
          </link_1.default>) : (info.getValue());
            }
        }),
        columnHelper.accessor("params", {
            header: "DSEQ",
            cell: function (info) {
                var _a;
                var params = info.getValue();
                return (_a = params === null || params === void 0 ? void 0 : params.dseq) !== null && _a !== void 0 ? _a : "N/A";
            }
        }),
        columnHelper.accessor("type", {
            header: "Type",
            cell: function (info) {
                var type = info.getValue();
                var params = info.row.original.params;
                if (type === "DEPLOYMENT_BALANCE") {
                    return "Escrow Threshold";
                }
                else if (params && "type" in params && params.type === "DEPLOYMENT_CLOSED") {
                    return "Deployment Close";
                }
                return (0, lodash_1.startCase)(type.toLowerCase());
            }
        }),
        columnHelper.accessor("status", {
            header: "Status",
            cell: function (info) { return <AlertStatus_1.AlertStatus status={info.getValue()}/>; }
        }),
        columnHelper.accessor("notificationChannelName", {
            header: "Notification Channel",
            cell: function (info) { return info.getValue(); }
        })
    ];
    var table = (0, react_table_1.useReactTable)({
        data: data,
        columns: columns,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        manualPagination: true,
        state: {
            columnVisibility: {
                enabled: isAlertUpdateEnabled
            },
            pagination: {
                pageIndex: pagination.page - 1,
                pageSize: pagination.limit
            }
        },
        onPaginationChange: function (updaterOrValue) {
            var _a = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue, pageIndex = _a.pageIndex, pageSize = _a.pageSize;
            onPaginationChange({
                page: pageIndex + 1,
                limit: pageSize
            });
        }
    });
    if (isLoading) {
        return (<div className="flex items-center justify-center">
        <components_1.Spinner size="large"/>
      </div>);
    }
    if (isError) {
        return (<div className="flex items-center justify-center">
        <p className="text-red-500">Error loading alerts</p>
      </div>);
    }
    if (!data || data.length === 0) {
        return (<div className="flex items-center justify-center">
        <p className="text-gray-500">No alerts found</p>
      </div>);
    }
    return (<>
      <components_1.Table>
        <components_1.TableHeader>
          {table.getHeaderGroups().map(function (headerGroup) { return (<components_1.TableRow key={headerGroup.id}>
              {headerGroup.headers.map(function (header) { return (<components_1.TableHead key={header.id} className="h-12">
                  {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                </components_1.TableHead>); })}
            </components_1.TableRow>); })}
        </components_1.TableHeader>

        <components_1.TableBody>
          {table.getRowModel().rows.map(function (row) { return (<components_1.TableRow key={row.id} className="h-12 [&>td]:px-4">
              {row.getVisibleCells().map(function (cell) { return (<components_1.TableCell key={cell.id} className="align-middle">
                  {(0, react_table_1.flexRender)(cell.column.columnDef.cell, cell.getContext())}
                </components_1.TableCell>); })}
            </components_1.TableRow>); })}
        </components_1.TableBody>
      </components_1.Table>

      {pagination.total > components_1.MIN_PAGE_SIZE && (<div className="flex items-center justify-center pt-6">
          <components_1.CustomPagination totalPageCount={pagination.totalPages} pageIndex={pagination.page - 1} pageSize={pagination.limit} setPageIndex={table.setPageIndex} setPageSize={table.setPageSize}/>
        </div>)}
    </>);
};
exports.AlertsListView = AlertsListView;
