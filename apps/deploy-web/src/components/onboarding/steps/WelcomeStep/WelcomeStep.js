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
exports.WelcomeStep = void 0;
var react_1 = require("react");
var image_1 = require("next/image");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var TemplateCard_1 = require("./TemplateCard");
var TrialStatusBar_1 = require("./TrialStatusBar");
var WelcomeStep = function (_a) {
    var onComplete = _a.onComplete;
    var analyticsService = (0, ServicesProvider_1.useServices)().analyticsService;
    var _b = (0, react_1.useState)(false), isDeploying = _b[0], setIsDeploying = _b[1];
    var _c = (0, react_1.useState)(null), deployingTemplate = _c[0], setDeployingTemplate = _c[1];
    var handleDeployTemplate = function (templateName) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, , 2, 3]);
                    setIsDeploying(true);
                    setDeployingTemplate(templateName);
                    analyticsService.track("onboarding_completed", {
                        category: "onboarding",
                        template: templateName,
                        action: "deploy_template"
                    });
                    return [4 /*yield*/, onComplete(templateName)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    setIsDeploying(false);
                    setDeployingTemplate(null);
                    return [7 /*endfinally*/];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="mx-auto w-full max-w-7xl space-y-8">
      <TrialStatusBar_1.TrialStatusBar />

      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Akash Console</h1>
        <p className="text-base text-muted-foreground">Choose a template below to launch your first app in seconds.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TemplateCard_1.TemplateCard icon={<image_1.default src="/images/onboarding/hello_akash.svg" alt="Hello Akash" width={100} height={100}/>} title="Hello Akash!" description={<>
              A simple web app powered by Next.js, perfect for your first deployment on Akash. View and explore the full source code{" "}
              <a href="https://github.com/akash-network/hello-akash-world" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                here
              </a>
              .
            </>} onDeploy={function () { return handleDeployTemplate("hello-akash"); }} disabled={isDeploying} isLoading={deployingTemplate === "hello-akash"}/>
        <TemplateCard_1.TemplateCard icon={<image_1.default src="/images/onboarding/comfy_ui.svg" alt="ComfyUI" width={100} height={100}/>} title="ComfyUI" description="A powerful, modular Stable Diffusion tool that lets you build and run advanced image workflows using a visual, node-based interface." onDeploy={function () { return handleDeployTemplate("comfyui"); }} disabled={isDeploying} isLoading={deployingTemplate === "comfyui"}/>
        <TemplateCard_1.TemplateCard icon={<image_1.default src="/images/onboarding/llama.svg" alt="Llama" width={100} height={100}/>} title="Llama-3.1-8b" description="A cutting-edge language model built for fast, context-aware text generation. Access a wide range of advanced language tasks." onDeploy={function () { return handleDeployTemplate("llama-3.1-8b"); }} disabled={isDeploying} isLoading={deployingTemplate === "llama-3.1-8b"}/>
      </div>
    </div>);
};
exports.WelcomeStep = WelcomeStep;
