"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var Groups = function (_a) {
    var isLoading = _a.isLoading, setGroup = _a.setGroup;
    var _b = (0, react_1.useState)(false), open = _b[0], setOpen = _b[1];
    var _c = (0, useGitlabQuery_1.useGitLabGroups)(), data = _c.data, loadingWorkSpaces = _c.isLoading;
    return (<div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Group</h1>
        <p className="text-muted-foreground">Select a Group to use for deployment</p>
      </div>

      <components_1.Select onOpenChange={function (value) {
            setOpen(value);
        }} open={open} onValueChange={function (value) {
            setGroup(value);
        }}>
        <components_1.SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {isLoading || (loadingWorkSpaces && <components_1.Spinner size="small"/>)}
            <components_1.SelectValue placeholder={"Select"}/>
          </div>
        </components_1.SelectTrigger>
        <components_1.SelectContent>
          <components_1.SelectGroup>
            {data === null || data === void 0 ? void 0 : data.map(function (work) { return (<components_1.SelectItem key={work.path} value={work.path}>
                <div className="flex items-center">
                  <iconoir_react_1.GitlabFull className="mr-2"/>
                  {work.name}
                </div>
              </components_1.SelectItem>); })}
          </components_1.SelectGroup>
        </components_1.SelectContent>
      </components_1.Select>
    </div>);
};
exports.default = Groups;
