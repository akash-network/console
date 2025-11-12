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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewDeploymentContainer = void 0;
var react_1 = require("react");
var jotai_1 = require("jotai");
var navigation_1 = require("next/navigation");
var deploy_config_1 = require("@src/config/deploy.config");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var sdlStore_1 = require("@src/store/sdlStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var templates_1 = require("@src/utils/templates");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CreateLease_1 = require("./CreateLease/CreateLease");
var ManifestEdit_1 = require("./ManifestEdit");
var Stepper_1 = require("./Stepper");
var TemplateList_1 = require("./TemplateList");
var NewDeploymentContainer = function (_a) {
    var requestedTemplate = _a.template, templateId = _a.templateId;
    var _b = (0, react_1.useState)(false), isGitProviderTemplate = _b[0], setIsGitProviderTemplate = _b[1];
    var _c = (0, useTemplateQuery_1.useTemplates)(), isLoadingTemplates = _c.isLoading, templates = _c.templates;
    var _d = (0, react_1.useState)(null), activeStep = _d[0], setActiveStep = _d[1];
    var _e = (0, react_1.useState)(null), selectedTemplate = _e[0], setSelectedTemplate = _e[1];
    var _f = (0, react_1.useState)(""), editedManifest = _f[0], setEditedManifest = _f[1];
    var deploySdl = (0, jotai_1.useAtomValue)(sdlStore_1.default.deploySdl);
    var getDeploymentData = (0, LocalNoteProvider_1.useLocalNotes)().getDeploymentData;
    var router = (0, navigation_1.useRouter)();
    var searchParams = (0, navigation_1.useSearchParams)();
    var dseq = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("dseq");
    var _g = (0, SdlBuilderProvider_1.useSdlBuilder)(), toggleCmp = _g.toggleCmp, hasComponent = _g.hasComponent;
    (0, react_1.useEffect)(function () {
        var queryStep = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("step");
        var _activeStep = getStepIndexByParam(queryStep);
        setActiveStep(_activeStep);
        var redeploy = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("redeploy");
        var code = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("code");
        var gitProvider = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("gitProvider");
        var state = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("state");
        var templateId = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("templateId");
        var shouldRedirectToGitlab = !redeploy && state === "gitlab" && code;
        var isGitProvider = gitProvider === "github" || code || state === "gitlab" || (templateId && templateId === remote_deploy_config_1.CI_CD_TEMPLATE_ID);
        if (shouldRedirectToGitlab) {
            router.replace(urlUtils_1.UrlService.newDeployment({
                step: route_steps_type_1.RouteStep.editDeployment,
                gitProvider: "github",
                gitProviderCode: code,
                templateId: remote_deploy_config_1.CI_CD_TEMPLATE_ID
            }));
        }
        else {
            setIsGitProviderTemplate(!!isGitProvider);
        }
    }, [searchParams]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var templateId = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("templateId");
        var isCreating = !!activeStep && activeStep > getStepIndexByParam(route_steps_type_1.RouteStep.chooseTemplate);
        if (!templates || (isCreating && !!editedManifest && !!templateId))
            return;
        var template = getRedeployTemplate() || getGalleryTemplate() || deploySdl;
        var isUserTemplate = (template === null || template === void 0 ? void 0 : template.code) === deploy_config_1.USER_TEMPLATE_CODE;
        var isUserTemplateInit = isUserTemplate && !!editedManifest;
        if (!template || isUserTemplateInit)
            return;
        setSelectedTemplate(template);
        setEditedManifest(template.content);
        if ("config" in template && (((_a = template.config) === null || _a === void 0 ? void 0 : _a.ssh) || (!((_b = template.config) === null || _b === void 0 ? void 0 : _b.ssh) && hasComponent("ssh")))) {
            toggleCmp("ssh");
        }
        var isRemoteYamlImage = (0, remote_deployment_controller_service_1.isCiCdImageInYaml)(template === null || template === void 0 ? void 0 : template.content);
        var queryStep = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("step");
        if (queryStep !== route_steps_type_1.RouteStep.editDeployment) {
            if (isRemoteYamlImage) {
                setIsGitProviderTemplate(true);
            }
            var newParams = isRemoteYamlImage
                ? __assign(__assign({}, searchParams), { step: route_steps_type_1.RouteStep.editDeployment, gitProvider: "github" }) : __assign(__assign({}, searchParams), { step: route_steps_type_1.RouteStep.editDeployment });
            router.replace(urlUtils_1.UrlService.newDeployment(newParams));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templates, editedManifest, searchParams, router, toggleCmp, hasComponent, activeStep]);
    var getRedeployTemplate = function () {
        var template = null;
        var queryRedeploy = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("redeploy");
        if (queryRedeploy) {
            var deploymentData = getDeploymentData(queryRedeploy);
            if (deploymentData && deploymentData.manifest) {
                template = {
                    name: deploymentData.name,
                    code: "empty",
                    content: deploymentData.manifest
                };
            }
        }
        return template;
    };
    var getGalleryTemplate = (0, react_1.useCallback)(function () {
        return requestedTemplate
            ? {
                code: "empty",
                name: requestedTemplate.name,
                content: requestedTemplate.deploy,
                valuesToChange: [],
                config: requestedTemplate.config
            }
            : templates_1.hardcodedTemplates.find(function (t) { return t.code === templateId; });
    }, [requestedTemplate, templateId]);
    function getStepIndexByParam(step) {
        switch (step) {
            case route_steps_type_1.RouteStep.editDeployment:
                return 1;
            case route_steps_type_1.RouteStep.createLeases:
                return 2;
            case route_steps_type_1.RouteStep.chooseTemplate:
            default:
                return 0;
        }
    }
    return (<Layout_1.default isLoading={isLoadingTemplates} isUsingSettings isUsingWallet containerClassName="pb-0 h-full">
      {!!activeStep && (<div className="flex w-full items-center">
          <Stepper_1.CustomizedSteppers activeStep={activeStep}/>
        </div>)}

      {activeStep === 0 && (<TemplateList_1.TemplateList onChangeGitProvider={setIsGitProviderTemplate} onTemplateSelected={setSelectedTemplate} setEditedManifest={setEditedManifest}/>)}
      {activeStep === 1 && (<ManifestEdit_1.ManifestEdit selectedTemplate={selectedTemplate} onTemplateSelected={setSelectedTemplate} editedManifest={editedManifest} setEditedManifest={setEditedManifest} isGitProviderTemplate={isGitProviderTemplate}/>)}
      {activeStep === 2 && <CreateLease_1.CreateLease dseq={dseq}/>}
    </Layout_1.default>);
};
exports.NewDeploymentContainer = NewDeploymentContainer;
