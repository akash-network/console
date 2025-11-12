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
exports.TemplateList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var material_1 = require("@mui/material");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var sdlStore_1 = require("@src/store/sdlStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var templates_1 = require("@src/utils/templates");
var urlUtils_1 = require("@src/utils/urlUtils");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var TemplateBox_1 = require("../templates/TemplateBox");
var DeployOptionBox_1 = require("./DeployOptionBox");
var previewTemplateIds = [
    "akash-network-awesome-akash-DeepSeek-R1-Distill-Llama-70B",
    "akash-network-awesome-akash-Llama-3.1-8B",
    "akash-network-awesome-akash-Llama-3.1-405B-FP8",
    "akash-network-awesome-akash-Llama-3.1-405B-BF16",
    "akash-network-awesome-akash-FLock-training-node",
    "akash-network-awesome-akash-tensorflow-jupyter-mnist",
    "akash-network-awesome-akash-comfyui",
    "akash-network-awesome-akash-Falcon-7B",
    "akash-network-awesome-akash-stable-diffusion-ui",
    "akash-network-awesome-akash-bert",
    "akash-network-awesome-akash-open-gpt",
    "akash-network-awesome-akash-grok",
    "akash-network-awesome-akash-FastChat"
];
var TemplateList = function (_a) {
    var onChangeGitProvider = _a.onChangeGitProvider, onTemplateSelected = _a.onTemplateSelected, setEditedManifest = _a.setEditedManifest;
    var templates = (0, useTemplateQuery_1.useTemplates)().templates;
    var router = (0, navigation_1.useRouter)();
    var _b = (0, react_1.useState)([]), previewTemplates = _b[0], setPreviewTemplates = _b[1];
    var _c = (0, jotai_1.useAtom)(sdlStore_1.default.selectedSdlEditMode), setSdlEditMode = _c[1];
    var handleGithubTemplate = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            analytics_service_1.analyticsService.track("build_n_deploy_btn_clk", "Amplitude");
            onChangeGitProvider(true);
            router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment, gitProvider: "github", templateId: remote_deploy_config_1.CI_CD_TEMPLATE_ID }));
            return [2 /*return*/];
        });
    }); };
    (0, react_1.useEffect)(function () {
        if (templates) {
            var _previewTemplates = previewTemplateIds
                .map(function (id) { return templates.find(function (template) { return template.id === id; }); })
                .filter(function (template) { return template !== undefined; });
            setPreviewTemplates(_previewTemplates);
        }
    }, [templates]);
    function onSDLBuilderClick(page) {
        if (page === void 0) { page = "new-deployment"; }
        analytics_service_1.analyticsService.track(page === "deploy-linux" ? "launch_container_vm_btn_clk" : "run_custom_container_btn_clk", "Amplitude");
        setEditedManifest("");
        onTemplateSelected(null);
        setSdlEditMode("builder");
        router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment, page: page }));
    }
    var onFileSelect = function (file) {
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function (event) {
            var _a, _b;
            onTemplateSelected({
                title: "From file",
                code: "from-file",
                category: "General",
                description: "Custom uploaded file",
                content: (_a = event.target) === null || _a === void 0 ? void 0 : _a.result
            });
            setEditedManifest((_b = event.target) === null || _b === void 0 ? void 0 : _b.result);
            setSdlEditMode("yaml");
            router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment }));
        };
        reader.readAsText(file);
    };
    return (<div className="my-0 pb-8 md:my-12">
      <CustomNextSeo_1.CustomNextSeo title="Create Deployment - Template List" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.chooseTemplate }))}/>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="col-span-3 grid grid-cols-1 gap-4 md:col-span-1">
          <DeployOptionBox_1.DeployOptionBox title="Build & Deploy" description="Build & Deploy directly from a code repository (VCS)" topIcons={[{ light: "/images/github.png", dark: "/images/github-dark.svg" }, "/images/gitlab.png", "/images/bitbucket.png"]} bottomIcons={[
            { light: "/images/nextjs.png", dark: "/images/nextjs-dark.svg" },
            "/images/vuejs.png",
            { light: "/images/astrojs.png", dark: "/images/astrojs-dark.svg" },
            "/images/python.png"
        ]} onClick={handleGithubTemplate} testId="build-and-deploy-card"/>

          <DeployOptionBox_1.DeployOptionBox title="Launch Container-VM" description="Deploy and work with a plain-linux vm-like container" topIcons={["/images/docker-logo.png", "/images/vm.png"]} bottomIcons={["/images/ubuntu.png", "/images/centos.png", "/images/debian.png", "/images/suse.png"]} onClick={function () { return onSDLBuilderClick("deploy-linux"); }} testId="plain-linux-card"/>

          <DeployOptionBox_1.DeployOptionBox title="Run Custom Container" description="Run your own docker container stored in a private or public container registry" topIcons={["/images/docker-logo.png"]} onClick={function () { return onSDLBuilderClick(); }} testId="custom-container-card"/>

          <components_1.FileButton onFileSelect={onFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="outline" className="space-x-2 bg-card text-foreground">
            <iconoir_react_1.Upload className="text-xs"/>
            <span className="text-xs">Upload your SDL</span>
          </components_1.FileButton>
        </div>

        <components_1.Card className="col-span-3">
          <material_1.CardContent>
            <div className="mb-4">
              <h3 className="mb-2 text-xl font-bold tracking-tight">Explore Templates</h3>

              <p className="text-sm text-muted-foreground">
                Browse through the marketplace of pre-made solutions with categories like AI&ML, Blockchain nodes and more!{" "}
                <link_1.default href={urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment, templateId: templates_1.helloWorldTemplate.code })} className="text-inherit underline" prefetch={false} data-testid="hello-world-card">
                  Try hello world app!
                </link_1.default>
              </p>
            </div>

            <div className="my-6">
              <link_1.default href={urlUtils_1.UrlService.templates()} prefetch={false} className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground">
                <span>View All Templates</span>
                <iconoir_react_1.ArrowRight className="text-xs"/>
              </link_1.default>
            </div>

            <section className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-3" aria-label="Template list">
              {previewTemplates.map(function (template) { return (<TemplateBox_1.TemplateBox key={template.id} template={template} linkHref={urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment, templateId: template === null || template === void 0 ? void 0 : template.id })}/>); })}
            </section>
          </material_1.CardContent>
        </components_1.Card>
      </div>
    </div>);
};
exports.TemplateList = TemplateList;
