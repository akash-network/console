"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var useBitBucketQuery_1 = require("../../../queries/useBitBucketQuery");
var WorkSpaces = function (_a) {
    var _b;
    var isLoading = _a.isLoading, setWorkSpaces = _a.setWorkSpaces;
    var _c = (0, react_1.useState)(false), open = _c[0], setOpen = _c[1];
    var _d = (0, useBitBucketQuery_1.useWorkspaces)(), data = _d.data, loadingWorkSpaces = _d.isLoading;
    return (<div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select WorkSpace</h1>
        <p className="text-muted-foreground">Select a Work-Space to use for deployment</p>
      </div>

      <components_1.Select onOpenChange={function (value) {
            setOpen(value);
        }} open={open} onValueChange={function (value) {
            setWorkSpaces(value);
        }}>
        <components_1.SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {isLoading || (loadingWorkSpaces && <components_1.Spinner size="small"/>)}
            <components_1.SelectValue placeholder={"Select"}/>
          </div>
        </components_1.SelectTrigger>
        <components_1.SelectContent>
          <components_1.SelectGroup>
            {(_b = data === null || data === void 0 ? void 0 : data.values) === null || _b === void 0 ? void 0 : _b.map(function (work) { return (<components_1.SelectItem key={work.uuid} value={work.uuid}>
                <div className="flex items-center">
                  <iconoir_react_1.Bitbucket className="mr-2"/>
                  {work.name}
                </div>
              </components_1.SelectItem>); })}
          </components_1.SelectGroup>
        </components_1.SelectContent>
      </components_1.Select>
    </div>);
};
exports.default = WorkSpaces;
