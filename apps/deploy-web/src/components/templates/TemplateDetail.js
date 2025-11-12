"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateDetail = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var GitHub_1 = require("@mui/icons-material/GitHub");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var DynamicMonacoEditor_1 = require("@src/components/shared/DynamicMonacoEditor");
var Markdown_1 = require("@src/components/shared/Markdown");
var ViewPanel_1 = require("@src/components/shared/ViewPanel");
var usePreviousRoute_1 = require("@src/hooks/usePreviousRoute");
var route_steps_type_1 = require("@src/types/route-steps.type");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var TemplateDetail = function (_a) {
    var _b, _c, _d;
    var _e;
    var template = _a.template;
    var _f = (0, react_1.useState)("README"), activeTab = _f[0], setActiveTab = _f[1];
    var router = (0, navigation_1.useRouter)();
    var previousRoute = (0, usePreviousRoute_1.usePreviousRoute)();
    var goBack = (0, react_1.useCallback)(function () {
        if (previousRoute) {
            router.back();
        }
        else {
            router.push(urlUtils_1.UrlService.templates());
        }
    }, [previousRoute, router]);
    var openGithub = (0, react_1.useCallback)(function () {
        window.open(template.githubUrl, "_blank");
    }, [template]);
    return (<Layout_1.default disableContainer>
      <div className="[&>img]:max-w-full">
        <components_1.Tabs value={activeTab} onValueChange={setActiveTab}>
          <components_1.TabsList className="w-full rounded-none">
            <components_1.TabsTrigger value="README" className={(0, utils_1.cn)((_b = {}, _b["font-bold"] = activeTab === "README", _b))}>
              README
            </components_1.TabsTrigger>
            <components_1.TabsTrigger value="SDL" className={(0, utils_1.cn)((_c = {}, _c["font-bold"] = activeTab === "SDL", _c))}>
              View SDL
            </components_1.TabsTrigger>
            {template.guide && (<components_1.TabsTrigger value="GUIDE" className={(0, utils_1.cn)((_d = {}, _d["font-bold"] = activeTab === "GUIDE", _d))}>
                Guide
              </components_1.TabsTrigger>)}
          </components_1.TabsList>

          <div className="container flex h-full px-4 py-2 sm:pt-8">
            <div className="flex items-center truncate">
              <components_1.Button aria-label="back" onClick={goBack} size="icon" variant="ghost">
                <iconoir_react_1.NavArrowLeft />
              </components_1.Button>
              <div className="text-truncate">
                <h3 className="ml-4 text-xl font-bold sm:text-2xl md:text-3xl">{template.name}</h3>
              </div>

              <div className="ml-4">
                <components_1.Button aria-label="View on github" title="View on Github" onClick={openGithub} size="icon" variant="ghost">
                  <GitHub_1.default fontSize="medium"/>
                </components_1.Button>
              </div>

              <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "ml-4 md:ml-8")} href={urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment, templateId: template.id })}>
                Deploy&nbsp;
                <iconoir_react_1.Rocket className="rotate-45"/>
              </link_1.default>
            </div>
          </div>

          {activeTab === "README" && (<ViewPanel_1.default stickToBottom className="overflow-auto pb-12">
              <div className="container pb-8 pt-4 sm:pt-8">
                <Markdown_1.default hasHtml={(_e = template.id) === null || _e === void 0 ? void 0 : _e.startsWith("akash-network-awesome-akash")}>{template.readme}</Markdown_1.default>
              </div>
            </ViewPanel_1.default>)}
          {activeTab === "SDL" && (<ViewPanel_1.default stickToBottom className="overflow-hidden">
              <div className="container h-full pb-8 pt-4 sm:pt-8">
                <DynamicMonacoEditor_1.DynamicMonacoEditor height="100%" language="yaml" value={template.deploy || ""} options={{ readOnly: true }}/>
              </div>
            </ViewPanel_1.default>)}
          {activeTab === "GUIDE" && (<ViewPanel_1.default stickToBottom className="overflow-auto p-4 pb-12">
              <div className="container h-full pb-8 pt-4 sm:pt-8">
                <Markdown_1.default>{template.guide}</Markdown_1.default>
              </div>
            </ViewPanel_1.default>)}
        </components_1.Tabs>
      </div>
    </Layout_1.default>);
};
exports.TemplateDetail = TemplateDetail;
