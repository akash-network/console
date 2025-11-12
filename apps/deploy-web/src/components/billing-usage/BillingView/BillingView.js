"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingView = exports.COMPONENTS = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var react_table_1 = require("@tanstack/react-table");
var date_fns_1 = require("date-fns");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var Title_1 = require("@src/components/shared/Title");
var stringUtils_1 = require("@src/utils/stringUtils");
exports.COMPONENTS = {
    FormattedNumber: react_intl_1.FormattedNumber,
    DateRangePicker: components_1.DateRangePicker,
    PaginationSizeSelector: components_1.PaginationSizeSelector
};
var BillingView = function (_a) {
    var data = _a.data, hasMore = _a.hasMore, hasPrevious = _a.hasPrevious, isFetching = _a.isFetching, errorMessage = _a.errorMessage, isError = _a.isError, onExport = _a.onExport, onPaginationChange = _a.onPaginationChange, pagination = _a.pagination, dateRange = _a.dateRange, onDateRangeChange = _a.onDateRangeChange, _b = _a.components, _c = _b === void 0 ? exports.COMPONENTS : _b, FormattedNumber = _c.FormattedNumber, DateRangePicker = _c.DateRangePicker, PaginationSizeSelector = _c.PaginationSizeSelector;
    var oneYearAgo = (0, date_fns_1.startOfDay)((0, date_fns_1.subYears)(new Date(), 1));
    var columnHelper = (0, react_table_1.createColumnHelper)();
    var columns = [
        columnHelper.accessor("created", {
            header: "Date",
            cell: function (info) { return new Date(info.getValue() * 1000).toLocaleDateString(); }
        }),
        columnHelper.accessor("amount", {
            header: "Amount",
            cell: function (info) { return <FormattedNumber value={info.getValue() / 100} style="currency" currency={info.row.original.currency} currencyDisplay="narrowSymbol"/>; }
        }),
        columnHelper.accessor("paymentMethod.card.brand", {
            header: "Account source",
            cell: function (info) {
                var card = info.row.original.paymentMethod.card;
                if (!card)
                    return "N/A";
                return "".concat((0, stringUtils_1.capitalizeFirstLetter)(card.brand), " **** ").concat(card.last4);
            }
        }),
        columnHelper.accessor("status", {
            header: "Status",
            cell: function (info) { return (<div className={(0, utils_1.cn)("inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold", info.getValue() === "succeeded"
                    ? "bg-green-100 text-green-800"
                    : info.getValue() === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : info.getValue() === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800")}>
          {(0, stringUtils_1.capitalizeFirstLetter)(info.getValue())}
        </div>); }
        }),
        columnHelper.display({
            id: "receipt",
            header: "Receipt",
            cell: function (info) { return (<components_1.CustomTooltip title={<p className="text-sm">View Receipt on Stripe</p>}>
          <link_1.default href={info.row.original.receiptUrl || "#"} target="_blank" rel="noopener noreferrer">
            <components_1.Button size="icon" variant="ghost" className="text-black hover:bg-primary hover:text-white dark:text-white">
              <iconoir_react_1.Page width={16}/>
            </components_1.Button>
          </link_1.default>
        </components_1.CustomTooltip>); }
        })
    ];
    var table = (0, react_table_1.useReactTable)({
        data: data,
        columns: columns,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        manualPagination: true,
        state: {
            pagination: pagination
        },
        onPaginationChange: function (updaterOrValue) {
            var _a = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue, pageIndex = _a.pageIndex, pageSize = _a.pageSize;
            onPaginationChange({
                pageIndex: pageIndex,
                pageSize: pageSize
            });
        }
    });
    if (isFetching) {
        return (<div className="flex h-full items-center justify-center">
        <components_1.Spinner size="large"/>
      </div>);
    }
    if (isError) {
        return (<components_1.Alert variant="destructive">
        <components_1.AlertTitle>Error fetching billing data</components_1.AlertTitle>
        <components_1.AlertDescription>{errorMessage || "An unexpected error occurred."}</components_1.AlertDescription>
      </components_1.Alert>);
    }
    var columnClasses = ["w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-32 px-4 py-2", "w-4 px-4 py-2"];
    return (<div className="space-y-2">
      <Title_1.Title subTitle>History</Title_1.Title>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <components_1.Label>Filter by Date:</components_1.Label>
          <DateRangePicker date={dateRange} onChange={onDateRangeChange} className="w-full" minDate={oneYearAgo} maxDate={(0, date_fns_1.endOfToday)()} maxRangeInDays={366}/>
        </div>

        <components_1.Button variant="secondary" onClick={onExport} className="h-12 gap-4" disabled={!data.length || !dateRange.from || !dateRange.to}>
          <iconoir_react_1.Download width={16}/>
          Export as CSV
        </components_1.Button>
      </div>

      {!data.length && (<div className="text-center text-muted-foreground">
          <p>No billing history found for the selected date range.</p>
        </div>)}

      {!!data.length && (<div>
          <components_1.Table className="table-fixed">
            <components_1.TableHeader className="[&_tr]:border-b-0">
              {table.getHeaderGroups().map(function (headerGroup) { return (<components_1.TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map(function (header, index) { return (<components_1.TableHead key={header.id} className={columnClasses[index]}>
                      {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                    </components_1.TableHead>); })}
                </components_1.TableRow>); })}
            </components_1.TableHeader>
          </components_1.Table>

          <div className="rounded border border-muted-foreground/20">
            <components_1.Table className="table-fixed">
              <components_1.TableBody>
                {table.getRowModel().rows.map(function (row) { return (<components_1.TableRow key={row.id}>
                    {row.getVisibleCells().map(function (cell, index) { return (<components_1.TableCell key={cell.id} className={columnClasses[index]}>
                        {(0, react_table_1.flexRender)(cell.column.columnDef.cell, cell.getContext())}
                      </components_1.TableCell>); })}
                  </components_1.TableRow>); })}
              </components_1.TableBody>
            </components_1.Table>
          </div>

          <components_1.Pagination className="flex flex-col justify-start gap-2 pt-2 sm:flex-row sm:items-center sm:gap-0 sm:pt-6">
            <PaginationSizeSelector pageSize={pagination.pageSize} setPageSize={function (pageSize) {
                onPaginationChange({
                    pageIndex: 0,
                    pageSize: pageSize
                });
            }}/>

            <components_1.PaginationContent className="flex items-center space-x-1">
              <components_1.PaginationItem className="hidden sm:list-item">
                <components_1.PaginationPrevious onClick={function () {
                return onPaginationChange({
                    pageIndex: Math.max(0, pagination.pageIndex - 1),
                    pageSize: pagination.pageSize
                });
            }} disabled={!hasPrevious || isFetching} className="h-8 px-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 [&_span]:hidden sm:[&_span]:inline-block"/>
              </components_1.PaginationItem>

              {hasPrevious && (<components_1.PaginationItem>
                  <components_1.PaginationLink className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300" disabled={isFetching} onClick={function () {
                    return onPaginationChange({
                        pageIndex: pagination.pageIndex - 1,
                        pageSize: pagination.pageSize
                    });
                }}>
                    {pagination.pageIndex}
                  </components_1.PaginationLink>
                </components_1.PaginationItem>)}

              <components_1.PaginationItem>
                <components_1.PaginationLink disabled className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
                  {pagination.pageIndex + 1}
                </components_1.PaginationLink>
              </components_1.PaginationItem>

              {hasMore && (<components_1.PaginationItem>
                  <components_1.PaginationLink className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300" disabled={isFetching} onClick={function () {
                    return onPaginationChange({
                        pageIndex: pagination.pageIndex + 1,
                        pageSize: pagination.pageSize
                    });
                }}>
                    {pagination.pageIndex + 2}
                  </components_1.PaginationLink>
                </components_1.PaginationItem>)}

              {pagination.pageIndex === 0 && hasMore && (<>
                  <components_1.PaginationItem>
                    <components_1.PaginationLink className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300" disabled={isFetching} onClick={function () {
                    return onPaginationChange({
                        pageIndex: 2,
                        pageSize: pagination.pageSize
                    });
                }}>
                      3
                    </components_1.PaginationLink>
                  </components_1.PaginationItem>
                  <components_1.PaginationEllipsis className="text-neutral-500 dark:text-neutral-400"/>
                </>)}

              <components_1.PaginationItem className="hidden sm:list-item">
                <components_1.PaginationNext onClick={function () { return onPaginationChange({ pageIndex: pagination.pageIndex + 1, pageSize: pagination.pageSize }); }} disabled={!hasMore || isFetching} className="h-8 px-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 [&_span]:hidden sm:[&_span]:inline-block"/>
              </components_1.PaginationItem>
            </components_1.PaginationContent>
          </components_1.Pagination>
        </div>)}
    </div>);
};
exports.BillingView = BillingView;
