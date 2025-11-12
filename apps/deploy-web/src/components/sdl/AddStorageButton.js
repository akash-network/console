"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStorageButton = void 0;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var data_1 = require("@src/utils/sdl/data");
var data_2 = require("../../utils/sdl/data");
var AddStorageButton = function (_a) {
    var services = _a.services, serviceIndex = _a.serviceIndex, storageIndex = _a.storageIndex, appendStorage = _a.appendStorage;
    var addPersistentStorage = function () {
        appendStorage(data_1.defaultPersistentStorage);
    };
    var addRamStorage = function () {
        appendStorage(data_2.defaultRamStorage);
    };
    var dropdownStyle = {
        borderLeft: "1px dashed rgba(255, 255, 255, 0.7)"
    };
    var serviceHasRamStorage = services[serviceIndex].profile.storage.some(function (storage) { return storage.type === "ram"; });
    return (<>
      {services[serviceIndex].profile.storage.length === storageIndex + 1 && (<div className="mt-2 flex items-center justify-end">
          <components_1.Button size="sm" className="rounded-l-md rounded-r-none" onClick={addPersistentStorage} type="button">
            Add Persistent Storage
          </components_1.Button>
          <components_1.DropdownMenu modal={true}>
            <components_1.DropdownMenuTrigger asChild>
              <components_1.Button size="sm" data-testid="deployment-detail-dropdown" className="rounded-l-none rounded-r-md px-2" style={dropdownStyle}>
                <iconoir_react_1.NavArrowDown />
              </components_1.Button>
            </components_1.DropdownMenuTrigger>
            <components_1.DropdownMenuContent align="end">
              <components_1.DropdownMenuItem disabled={serviceHasRamStorage} onClick={addRamStorage}>
                Add RAM Storage
              </components_1.DropdownMenuItem>
              <components_1.DropdownMenuItem onClick={addPersistentStorage}>Add Persistent Storage</components_1.DropdownMenuItem>
            </components_1.DropdownMenuContent>
          </components_1.DropdownMenu>
        </div>)}
    </>);
};
exports.AddStorageButton = AddStorageButton;
