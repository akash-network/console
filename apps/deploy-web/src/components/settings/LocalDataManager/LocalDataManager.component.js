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
exports.LocalDataManagerComponent = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var iconoir_react_1 = require("iconoir-react");
var LocalDataManagerComponent = function (_a) {
    var read = _a.read, write = _a.write, onDone = _a.onDone;
    var ref = (0, react_1.useRef)(null);
    var confirm = (0, context_1.usePopup)().confirm;
    var triggerFileUpload = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var isConfirmed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, confirm({
                        title: "Import Local Data",
                        message: "Existing local data will be overwritten. Are you sure you want to proceed?"
                    })];
                case 1:
                    isConfirmed = _b.sent();
                    if (isConfirmed) {
                        (_a = ref.current) === null || _a === void 0 ? void 0 : _a.click();
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [ref.current]);
    var importLocalData = (0, react_1.useCallback)(function (event) {
        var _a;
        var file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function () {
            var data = JSON.parse(reader.result);
            write(data);
            if (typeof onDone === "function") {
                onDone();
            }
        };
        reader.readAsText(file);
    }, []);
    var downloadLocalData = (0, react_1.useCallback)(function () {
        var data = JSON.stringify(read());
        var blob = new Blob([data], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "console.akash.network.data.json";
        link.click();
    }, []);
    return (<div className="grid-col-1 mt-4 grid gap-4 md:grid-cols-2">
      <components_1.Button onClick={downloadLocalData} size="sm" className="mt-6">
        <iconoir_react_1.Download className="text-sm"/>
        Export Local Data
      </components_1.Button>

      <input onChange={importLocalData} type="file" ref={ref} hidden accept=".json"/>

      <components_1.Button onClick={triggerFileUpload} size="sm" className="mt-6">
        <iconoir_react_1.Upload className="text-sm"/>
        Import Local Data
      </components_1.Button>
    </div>);
};
exports.LocalDataManagerComponent = LocalDataManagerComponent;
