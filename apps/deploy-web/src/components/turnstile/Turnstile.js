"use strict";
"use client";
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
exports.ClientOnlyTurnstile = exports.Turnstile = exports.COMPONENTS = void 0;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var react_turnstile_1 = require("@marsidev/react-turnstile");
var framer_motion_1 = require("framer-motion");
var dynamic_1 = require("next/dynamic");
var useWhen_1 = require("@src/hooks/useWhen");
var originalFetch;
var VISIBILITY_STATUSES = ["interactive", "error"];
exports.COMPONENTS = {
    ReactTurnstile: react_turnstile_1.Turnstile,
    Button: components_1.Button,
    MdInfo: md_1.MdInfo
};
var Turnstile = function (_a) {
    var enabled = _a.enabled, siteKey = _a.siteKey, _b = _a.components, c = _b === void 0 ? exports.COMPONENTS : _b;
    var turnstileRef = (0, react_1.useRef)();
    var _c = (0, react_1.useState)("uninitialized"), status = _c[0], setStatus = _c[1];
    var isVisible = (0, react_1.useMemo)(function () { return enabled && VISIBILITY_STATUSES.includes(status); }, [enabled, status]);
    var abortControllerRef = (0, react_1.useRef)();
    var resetWidget = (0, react_1.useCallback)(function () {
        var _a, _b, _c;
        (_a = turnstileRef.current) === null || _a === void 0 ? void 0 : _a.remove();
        (_b = turnstileRef.current) === null || _b === void 0 ? void 0 : _b.render();
        (_c = turnstileRef.current) === null || _c === void 0 ? void 0 : _c.execute();
    }, []);
    var renderTurnstileAndWaitForResponse = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            abortControllerRef.current = new AbortController();
            resetWidget();
            return [2 /*return*/, Promise.race([
                    (_a = turnstileRef.current) === null || _a === void 0 ? void 0 : _a.getResponsePromise(),
                    new Promise(function (resolve) { var _a; return (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.signal.addEventListener("abort", function () { return resolve(); }); })
                ])];
        });
    }); }, [resetWidget]);
    (0, react_1.useEffect)(function () {
        if (!enabled) {
            if (typeof originalFetch === "function") {
                globalThis.fetch = originalFetch;
                originalFetch = undefined;
            }
            return;
        }
        if (typeof globalThis.fetch === "function") {
            originalFetch = originalFetch || globalThis.fetch;
            var fetch_1 = originalFetch;
            globalThis.fetch = function (resource, options) { return __awaiter(void 0, void 0, void 0, function () {
                var response, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, fetch_1(resource, options)];
                        case 1:
                            response = _b.sent();
                            _a = response.headers.get("cf-mitigated") === "challenge" && turnstileRef.current;
                            if (!_a) return [3 /*break*/, 3];
                            return [4 /*yield*/, renderTurnstileAndWaitForResponse()];
                        case 2:
                            _a = (_b.sent());
                            _b.label = 3;
                        case 3:
                            if (_a) {
                                return [2 /*return*/, globalThis.fetch(resource, options)];
                            }
                            return [2 /*return*/, response];
                    }
                });
            }); };
        }
        return function () {
            if (typeof originalFetch === "function") {
                globalThis.fetch = originalFetch;
                originalFetch = undefined;
            }
        };
    }, [enabled]);
    (0, useWhen_1.useWhen)(status === "error", function () {
        resetWidget();
    });
    if (!enabled) {
        return null;
    }
    return (<>
      <framer_motion_1.motion.div className="fixed inset-0 z-[101] flex content-center items-center justify-center bg-popover/90" initial={{ opacity: 0 }} animate={{ opacity: isVisible ? 1 : 0 }} style={{ pointerEvents: isVisible ? "auto" : "none" }} transition={{
            duration: 0.3,
            delay: isVisible ? 0 : status === "dismissed" ? 0 : 1
        }}>
        <div className="flex flex-col items-center">
          <h3 className="mb-2 text-2xl font-bold">We are verifying you are a human. This may take a few seconds</h3>
          <p className="mb-8">Reviewing the security of your connection before proceeding</p>
          <div className="h-[66px]">
            <c.ReactTurnstile ref={turnstileRef} siteKey={siteKey} options={{ execution: "execute" }} onError={function () { return setStatus("error"); }} onExpire={function () { return setStatus("expired"); }} onSuccess={function () { return setStatus("solved"); }} onBeforeInteractive={function () { return setStatus("interactive"); }}/>
          </div>
          {status === "error" && <p className="text-red-600">Some error occurred</p>}
          <framer_motion_1.motion.div className="flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: isVisible ? 1 : 0 }} style={{ pointerEvents: isVisible ? "auto" : "none" }} transition={{
            duration: 0.3,
            delay: isVisible ? (status === "error" ? 0 : 5) : 1
        }}>
            <div className="my-8">
              <c.Button onClick={resetWidget} className="mr-4">
                Retry
              </c.Button>
              <c.Button onClick={function () {
            var _a, _b;
            setStatus("dismissed");
            (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.abort();
            (_b = turnstileRef.current) === null || _b === void 0 ? void 0 : _b.remove();
        }} variant="link">
                Dismiss
              </c.Button>
            </div>

            <p>
              <c.MdInfo className="mr-1 inline text-xl text-muted-foreground"/>
              <small>dismissing the check might result into some features not working properly</small>
            </p>
          </framer_motion_1.motion.div>
        </div>
      </framer_motion_1.motion.div>
    </>);
};
exports.Turnstile = Turnstile;
exports.ClientOnlyTurnstile = (0, dynamic_1.default)(function () { return Promise.resolve(exports.Turnstile); }, { ssr: false });
