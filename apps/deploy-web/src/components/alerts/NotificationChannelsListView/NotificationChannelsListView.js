"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannelsListView = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var utils_1 = require("@akashnetwork/ui/utils");
var react_table_1 = require("@tanstack/react-table");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var NotificationChannelsListView = function (_a) {
    var data = _a.data, pagination = _a.pagination, onPaginationChange = _a.onPaginationChange, isLoading = _a.isLoading, removingIds = _a.removingIds, onRemove = _a.onRemove, isError = _a.isError;
    var confirm = (0, context_1.usePopup)().confirm;
    var columnHelper = (0, react_table_1.createColumnHelper)();
    var columns = [
        columnHelper.accessor("name", {
            header: function () { return <div>Name</div>; },
            cell: function (info) { return <div>{info.getValue()}</div>; }
        }),
        columnHelper.accessor("type", {
            header: function () { return <div>Type</div>; },
            cell: function (info) { return <div>{info.getValue()}</div>; }
        }),
        columnHelper.accessor("config.addresses", {
            header: function () { return <div>Addresses</div>; },
            cell: function (info) {
                return info.getValue().map(function (emailAddress) { return (<components_1.CustomTooltip key={emailAddress} title={emailAddress}>
            <div className="max-w-48 truncate">{emailAddress}</div>
          </components_1.CustomTooltip>); });
            }
        }),
        columnHelper.display({
            id: "actions",
            cell: function (info) {
                var isRemoving = removingIds.has(info.row.original.id);
                return (<div className="flex items-center justify-end gap-1">
            <components_1.CustomTooltip title="Edit" disabled={isRemoving}>
              <link_1.default href={urlUtils_1.UrlService.notificationChannelDetails(info.row.original.id)} color="secondary" type="button" className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "ghost", size: "icon" }), "text-gray-500 hover:text-gray-700", isRemoving && "pointer-events-none")} aria-disabled={isRemoving} data-testid="edit-notification-channel-button">
                <iconoir_react_1.Edit className="text-xs"/>
              </link_1.default>
            </components_1.CustomTooltip>
            <components_1.CustomTooltip title="Remove" disabled={isRemoving}>
              <components_1.Button variant="ghost" size="icon" disabled={isRemoving} onClick={function () { return __awaiter(void 0, void 0, void 0, function () {
                        var isConfirmed;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, confirm({
                                        title: "Are you sure you want to remove this notification channel?",
                                        message: "This action cannot be undone.",
                                        testId: "remove-notification-channel-confirmation-popup"
                                    })];
                                case 1:
                                    isConfirmed = _a.sent();
                                    if (isConfirmed) {
                                        void onRemove(info.row.original.id);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); }} className="text-sm text-red-500 hover:text-red-700" data-testid="remove-notification-channel-button">
                {isRemoving ? <components_1.Spinner size="small"/> : <iconoir_react_1.Bin className="text-xs"/>}
              </components_1.Button>
            </components_1.CustomTooltip>
          </div>);
            }
        })
    ];
    var table = (0, react_table_1.useReactTable)({
        data: data,
        columns: columns,
        getCoreRowModel: (0, react_table_1.getCoreRowModel)(),
        manualPagination: true,
        state: {
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
        <p className="text-red-500">Error loading notification channels</p>
      </div>);
    }
    if (!data || data.length === 0) {
        return (<div className="flex items-center justify-center">
        <p className="text-gray-500">No notification channels found</p>
      </div>);
    }
    return (<>
      <components_1.Table>
        <components_1.TableHeader>
          {table.getHeaderGroups().map(function (headerGroup) { return (<components_1.TableRow key={headerGroup.id}>
              {headerGroup.headers.map(function (header) { return (<components_1.TableHead key={header.id} className="w-1/4">
                  {header.isPlaceholder ? null : (0, react_table_1.flexRender)(header.column.columnDef.header, header.getContext())}
                </components_1.TableHead>); })}
            </components_1.TableRow>); })}
        </components_1.TableHeader>

        <components_1.TableBody>
          {table.getRowModel().rows.map(function (row) { return (<components_1.TableRow key={row.id} className="[&>td]:px-4 [&>td]:py-2">
              {row.getVisibleCells().map(function (cell) { return (<components_1.TableCell key={cell.id} className="align-top">
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
exports.NotificationChannelsListView = NotificationChannelsListView;
