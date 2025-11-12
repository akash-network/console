"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingPage = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var CustomNextSeo_1 = require("@src/components/shared/CustomNextSeo");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var urlUtils_1 = require("@src/utils/urlUtils");
var OnboardingContainer_1 = require("./OnboardingContainer/OnboardingContainer");
var OnboardingView_1 = require("./OnboardingView/OnboardingView");
var OnboardingPage = function () {
    var analyticsService = (0, ServicesProvider_1.useServices)().analyticsService;
    var handleBackToConsole = function () {
        analyticsService.track("onboarding_back_to_console", {
            category: "onboarding"
        });
    };
    return (<div>
      <CustomNextSeo_1.CustomNextSeo title="Free Trial Onboarding" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.signup())}/>
      <div className="container mx-auto px-4 py-12">
        <OnboardingContainer_1.OnboardingContainer>{function (props) { return <OnboardingView_1.OnboardingView {...props}/>; }}</OnboardingContainer_1.OnboardingContainer>

        <div className="py-8 text-center">
          <link_1.default href={urlUtils_1.UrlService.home()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "ghost" }), "inline-flex items-center gap-2")} onClick={handleBackToConsole}>
            <iconoir_react_1.NavArrowLeft className="h-4 w-4"/>
            Back to Console
          </link_1.default>
        </div>
      </div>
    </div>);
};
exports.OnboardingPage = OnboardingPage;
