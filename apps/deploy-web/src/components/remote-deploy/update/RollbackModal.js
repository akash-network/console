"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var lucide_react_1 = require("lucide-react");
var nanoid_1 = require("nanoid");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var RollbackModal = function (_a) {
    var _b, _c, _d, _e;
    var commits = _a.commits, control = _a.control;
    var _f = (0, react_1.useState)([]), filteredCommits = _f[0], setFilteredCommits = _f[1];
    var _g = (0, react_1.useState)(""), searchQuery = _g[0], setSearchQuery = _g[1];
    var services = (0, react_hook_form_1.useFieldArray)({ control: control, name: "services", keyName: "id" }).fields;
    var _h = (0, react_hook_form_1.useFieldArray)({ control: control, name: "services.0.env", keyName: "id" }), append = _h.append, update = _h.update;
    var currentHash = (_c = (_b = services[0]) === null || _b === void 0 ? void 0 : _b.env) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.COMMIT_HASH; });
    (0, react_1.useEffect)(function () {
        if (commits) {
            setFilteredCommits(commits === null || commits === void 0 ? void 0 : commits.filter(function (item) {
                return item.name.toLowerCase().includes(searchQuery.toLowerCase());
            }));
        }
    }, [commits, searchQuery]);
    return (<div className="flex items-center gap-6">
      <components_1.Dialog>
        <components_1.DialogTrigger asChild>
          <components_1.Button variant="outline" className="line-clamp-1 flex w-full justify-between bg-popover">
            <span>{(currentHash === null || currentHash === void 0 ? void 0 : currentHash.value) ? (_e = (_d = commits === null || commits === void 0 ? void 0 : commits.find(function (item) { return item.value === (currentHash === null || currentHash === void 0 ? void 0 : currentHash.value); })) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : currentHash === null || currentHash === void 0 ? void 0 : currentHash.value : "Select"}</span>
            <lucide_react_1.GitGraph size={18}/>
          </components_1.Button>
        </components_1.DialogTrigger>
        <components_1.DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0">
          <components_1.DialogHeader className="sticky top-0 z-[20] border-b bg-popover p-5">
            <components_1.DialogTitle>Rollbacks</components_1.DialogTitle>
            <components_1.DialogDescription className="mt-1 flex items-center gap-2">
              <lucide_react_1.Info className="h-4 w-4"/>
              You need to click update deployment button to apply changes
            </components_1.DialogDescription>
          </components_1.DialogHeader>
          <components_1.Tabs defaultValue="git">
            <components_1.TabsList className="mx-5 mt-4">
              <components_1.TabsTrigger value="git">Commit Name</components_1.TabsTrigger>
              <components_1.TabsTrigger value="Custom">Commit Hash</components_1.TabsTrigger>
            </components_1.TabsList>
            <components_1.TabsContent value="git" className="mt-0 flex flex-col gap-6">
              <div className="flex flex-col">
                <div className="flex border-b px-5 py-4">
                  <components_1.Input placeholder="Search" className="w-full" value={searchQuery} onChange={function (e) {
            setSearchQuery(e.target.value);
        }}/>
                </div>
                {(filteredCommits === null || filteredCommits === void 0 ? void 0 : filteredCommits.length) > 0 ? (<components_1.RadioGroup value={currentHash === null || currentHash === void 0 ? void 0 : currentHash.value} onValueChange={function (value) {
                var _a, _b;
                var hash = { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.COMMIT_HASH, value: value, isSecret: false };
                if (currentHash) {
                    update((_b = (_a = services[0]) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.findIndex(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.COMMIT_HASH; }), hash);
                }
                else {
                    append(hash);
                }
            }}>
                    {filteredCommits === null || filteredCommits === void 0 ? void 0 : filteredCommits.map(function (item) { return (<div className="flex justify-between gap-4 border-b px-5 py-4" key={item.value}>
                        <components_1.Label htmlFor={item.value} className="flex flex-1 items-center gap-3 text-sm">
                          <lucide_react_1.GitCommitVertical />
                          <p className="flex-1">{item.name}</p>
                        </components_1.Label>
                        <components_1.RadioGroupItem value={item.value} id={item.value}/>
                      </div>); })}
                  </components_1.RadioGroup>) : (<></>)}
              </div>
            </components_1.TabsContent>
            <components_1.TabsContent value="Custom" className="mt-2 flex flex-col gap-6 px-5 py-4">
              <div className="flex flex-col gap-2">
                <components_1.Label htmlFor="manual">Commit Hash</components_1.Label>
                <components_1.Input value={currentHash === null || currentHash === void 0 ? void 0 : currentHash.value} placeholder="Commit Hash" onChange={function (e) {
            var _a, _b;
            var hash = { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.COMMIT_HASH, value: e.target.value, isSecret: false };
            if (currentHash) {
                update((_b = (_a = services[0]) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.findIndex(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.COMMIT_HASH; }), hash);
            }
            else {
                append(hash);
            }
        }}/>
              </div>
            </components_1.TabsContent>
          </components_1.Tabs>
        </components_1.DialogContent>
      </components_1.Dialog>
    </div>);
};
exports.default = RollbackModal;
