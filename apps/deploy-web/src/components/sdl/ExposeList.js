"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExposeList = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var FormPaper_1 = require("./FormPaper");
var ExposeList = function (_a) {
    var _b;
    var currentService = _a.currentService, setIsEditingExpose = _a.setIsEditingExpose, serviceIndex = _a.serviceIndex;
    var hasComponent = (0, SdlBuilderProvider_1.useSdlBuilder)().hasComponent;
    return (<FormPaper_1.FormPaper>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Expose</strong>

        <components_1.CustomTooltip title={<>
              Expose is a list of port settings describing what can connect to the service.
              {hasComponent("ssh") && (<>
                  <br />
                  <br />
                  Note: Port 22 is reserved for SSH and is going to be exposed by default.
                </>)}
              <br />
              <br />
              <a href="https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>}>
          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
        </components_1.CustomTooltip>

        <span className="ml-4 cursor-pointer text-sm font-normal text-primary underline" onClick={function () { return setIsEditingExpose(serviceIndex !== undefined ? serviceIndex : true); }}>
          Edit
        </span>
      </div>

      {(_b = currentService.expose) === null || _b === void 0 ? void 0 : _b.map(function (exp, i) {
            var _a;
            var _b, _c;
            return (<div key={i} className={(0, utils_1.cn)("text-xs", (_a = {}, _a["mb-2"] = i + 1 !== currentService.expose.length, _a))}>
          <div>
            <strong>Port</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">
              {exp.port} : {exp.as} ({exp.proto})
            </span>
          </div>
          <div>
            <strong>Global</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">{exp.global ? "True" : "False"}</span>
          </div>
          {exp.ipName && (<div>
              <strong>IP Name</strong>&nbsp;&nbsp;
              <span className="text-muted-foreground">{exp.ipName}</span>
            </div>)}
          <div>
            <strong>Accept</strong>&nbsp;&nbsp;
            <span className="text-muted-foreground">
              {(((_b = exp.accept) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0
                    ? (_c = exp.accept) === null || _c === void 0 ? void 0 : _c.map(function (a, i) {
                        var _a;
                        return (<span key={i} className={(0, utils_1.cn)((_a = {}, _a["ml-2"] = i !== 0, _a))}>
                      {a.value}
                    </span>);
                    })
                    : "None"}
            </span>
          </div>
        </div>);
        })}
    </FormPaper_1.FormPaper>);
};
exports.ExposeList = ExposeList;
