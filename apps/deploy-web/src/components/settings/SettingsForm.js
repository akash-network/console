"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.SettingsForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var zod_1 = require("@hookform/resolvers/zod");
var Autocomplete_1 = require("@mui/material/Autocomplete");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var FormControl_1 = require("@mui/material/FormControl");
var FormGroup_1 = require("@mui/material/FormGroup");
var InputAdornment_1 = require("@mui/material/InputAdornment");
var TextField_1 = require("@mui/material/TextField");
var iconoir_react_1 = require("iconoir-react");
var zod_2 = require("zod");
var NodeStatus_1 = require("@src/components/shared/NodeStatus");
var SettingsProviderContext_1 = require("@src/context/SettingsProvider/SettingsProviderContext");
var formSchema = zod_2.z.object({
    apiEndpoint: zod_2.z
        .string()
        .min(1, {
        message: "Api endpoint is required."
    })
        .url({
        message: "Url is invalid."
    }),
    rpcEndpoint: zod_2.z.string().min(1, "Rpc endpoint is required.").url({
        message: "Url is invalid."
    })
});
var SettingsForm = function () {
    var _a, _b;
    var _c = (0, react_1.useState)(false), isEditing = _c[0], setIsEditing = _c[1];
    var _d = (0, react_1.useState)(false), isNodesOpen = _d[0], setIsNodesOpen = _d[1];
    var _e = (0, SettingsProviderContext_1.useSettings)(), settings = _e.settings, setSettings = _e.setSettings, refreshNodeStatuses = _e.refreshNodeStatuses, isRefreshingNodeStatus = _e.isRefreshingNodeStatus;
    var form = (0, react_hook_form_1.useForm)({
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var control = form.control, handleSubmit = form.handleSubmit, reset = form.reset;
    var formRef = (0, react_1.useRef)(null);
    var selectedNode = settings.selectedNode, nodes = settings.nodes;
    var onIsCustomNodeChange = function (checked) {
        var apiEndpoint = checked ? settings.apiEndpoint : selectedNode === null || selectedNode === void 0 ? void 0 : selectedNode.api;
        var rpcEndpoint = checked ? settings.rpcEndpoint : selectedNode === null || selectedNode === void 0 ? void 0 : selectedNode.rpc;
        reset();
        var newSettings = __assign(__assign({}, settings), { isCustomNode: checked, apiEndpoint: apiEndpoint, rpcEndpoint: rpcEndpoint });
        setSettings(newSettings);
        refreshNodeStatuses(newSettings);
    };
    var onNodeChange = function (_, newNodeId) {
        var newNode = nodes.find(function (n) { return n.id === newNodeId; });
        var apiEndpoint = newNode === null || newNode === void 0 ? void 0 : newNode.api;
        var rpcEndpoint = newNode === null || newNode === void 0 ? void 0 : newNode.rpc;
        setSettings(__assign(__assign({}, settings), { apiEndpoint: apiEndpoint, rpcEndpoint: rpcEndpoint, selectedNode: newNode }));
    };
    var onRefreshNodeStatus = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, refreshNodeStatuses()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    /**
     *  Update the custom settings
     * @param {Object} data {apiEndpoint: string, rpcEndpoint: string}
     */
    var onSubmit = function (data) {
        var customNodeUrl = new URL(data.apiEndpoint);
        setIsEditing(false);
        var newSettings = __assign(__assign(__assign({}, settings), data), { customNode: __assign(__assign({}, settings.customNode), { id: customNodeUrl.hostname }) });
        setSettings(newSettings);
        refreshNodeStatuses(newSettings);
    };
    return (<div className="pt-6">
      <div className="pb-2">
        <components_1.SwitchWithLabel checked={!!settings.isCustomNode} onCheckedChange={onIsCustomNodeChange} label="Custom Node"/>
      </div>

      {settings.isCustomNode && (<components_1.Form {...form}>
          <form className="pt-4" onSubmit={handleSubmit(onSubmit)} ref={formRef}>
            <div className="mb-2 flex items-center">
              <components_1.Label className="min-w-[150px] basis-[20%] pr-4">Api Endpoint:</components_1.Label>

              {isEditing ? (<components_1.FormField control={control} name="apiEndpoint" defaultValue={settings.apiEndpoint} render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} type="text" className="flex-1"/>;
            }}/>) : (<p className="flex-grow">{settings.apiEndpoint}</p>)}
            </div>

            <div className="mb-2 flex items-center">
              <components_1.Label className="min-w-[150px] basis-[20%] pr-4">Rpc Endpoint:</components_1.Label>

              {isEditing ? (<components_1.FormField control={control} name="rpcEndpoint" defaultValue={settings.rpcEndpoint} render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} type="text" className="flex-1"/>;
            }}/>) : (<p className="flex-grow">{settings.rpcEndpoint}</p>)}
            </div>

            <div className="pt-4">
              {!isEditing && (<components_1.Button variant="default" onClick={function () { return setIsEditing(!isEditing); }} size="sm">
                  Edit
                </components_1.Button>)}

              {isEditing && (<>
                  <components_1.Button variant="text" onClick={function () {
                    reset({}, { keepDefaultValues: true });
                    setIsEditing(false);
                }} size="sm">
                    Cancel
                  </components_1.Button>
                  <components_1.Button variant="default" type="submit" className="ml-4" onClick={function () { var _a; return (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit")); }} size="sm">
                    Submit
                  </components_1.Button>
                </>)}
            </div>
          </form>
        </components_1.Form>)}

      {!settings.isCustomNode && (<div className="mt-4">
          <FormGroup_1.default>
            <div className="flex items-center">
              <FormControl_1.default className="flex-1">
                <Autocomplete_1.default disableClearable open={isNodesOpen} options={nodes.map(function (n) { return n.id; })} value={(_a = settings.selectedNode) === null || _a === void 0 ? void 0 : _a.id} defaultValue={(_b = settings.selectedNode) === null || _b === void 0 ? void 0 : _b.id} fullWidth size="small" onChange={onNodeChange} renderInput={function (params) { return (<ClickAwayListener_1.default onClickAway={function () { return setIsNodesOpen(false); }}>
                      <TextField_1.default {...params} label="Node" variant="outlined" onClick={function () { return setIsNodesOpen(function (prev) { return !prev; }); }} InputProps={__assign(__assign({}, params.InputProps), { classes: { root: (0, utils_1.cn)("!pr-3 cursor-pointer"), input: "cursor-pointer" }, endAdornment: (<InputAdornment_1.default position="end">
                              <div className="mr-2 inline-flex">
                                <iconoir_react_1.NavArrowDown className="text-xs"/>
                              </div>
                              <NodeStatus_1.NodeStatus latency={Math.floor((selectedNode === null || selectedNode === void 0 ? void 0 : selectedNode.latency) || 0)} status={(selectedNode === null || selectedNode === void 0 ? void 0 : selectedNode.status) || ""} variant="dense"/>
                            </InputAdornment_1.default>) })}/>
                    </ClickAwayListener_1.default>); }} renderOption={function (props, option) {
                var node = nodes.find(function (n) { return n.id === option; });
                return (<li {...props}>
                        <div className="flex w-full items-center justify-between px-2 py-1">
                          <div>{option}</div>
                          <NodeStatus_1.NodeStatus latency={Math.floor((node === null || node === void 0 ? void 0 : node.latency) || 0)} status={(node === null || node === void 0 ? void 0 : node.status) || ""} variant="dense"/>
                        </div>
                      </li>);
            }} disabled={settings.isCustomNode}/>
              </FormControl_1.default>

              <div className="ml-4">
                <components_1.Button onClick={function () { return onRefreshNodeStatus(); }} aria-label="refresh" disabled={isRefreshingNodeStatus} size="icon" variant="outline">
                  {isRefreshingNodeStatus ? <components_1.Spinner size="small"/> : <iconoir_react_1.Refresh />}
                </components_1.Button>
              </div>
            </div>
          </FormGroup_1.default>
        </div>)}
    </div>);
};
exports.SettingsForm = SettingsForm;
