"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandList = void 0;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var FormPaper_1 = require("./FormPaper");
var CommandList = function (_a) {
    var _b, _c, _d, _e;
    var currentService = _a.currentService, setIsEditingCommands = _a.setIsEditingCommands, serviceIndex = _a.serviceIndex;
    return (<FormPaper_1.FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Commands</strong>

        <components_1.CustomTooltip title={<>
              Custom command used when executing container.
              <br />
              <br />
              An example and popular use case is to run a bash script to install packages or run specific commands.
            </>}>
          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
        </components_1.CustomTooltip>

        <span className="ml-4 cursor-pointer text-sm font-normal text-primary underline" onClick={function () { return setIsEditingCommands(serviceIndex !== undefined ? serviceIndex : true); }}>
          Edit
        </span>
      </div>

      {(((_c = (_b = currentService === null || currentService === void 0 ? void 0 : currentService.command) === null || _b === void 0 ? void 0 : _b.command) === null || _c === void 0 ? void 0 : _c.length) || 0) > 0 ? (<div className="whitespace-pre-wrap text-xs">
          <div>{(_d = currentService.command) === null || _d === void 0 ? void 0 : _d.command}</div>
          <div className="text-muted-foreground">{(_e = currentService.command) === null || _e === void 0 ? void 0 : _e.arg}</div>
        </div>) : (<p className="text-xs text-muted-foreground">None</p>)}
    </FormPaper_1.FormPaper>);
};
exports.CommandList = CommandList;
