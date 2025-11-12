"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeTrialLandingStep = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var AkashLogo_1 = require("@src/components/layout/AkashLogo");
var Title_1 = require("@src/components/shared/Title");
var urlUtils_1 = require("@src/utils/urlUtils");
var benefits = [
    {
        icon: <iconoir_react_1.Rocket className="h-6 w-6" aria-hidden="true"/>,
        title: "Start Deploying in Minutes",
        description: "Get your applications running on Akash Network with our streamlined deployment process."
    },
    {
        icon: <iconoir_react_1.Cloud className="h-6 w-6" aria-hidden="true"/>,
        title: "Access to Global Infrastructure",
        description: "Deploy across a worldwide network of providers with competitive pricing."
    },
    {
        icon: <iconoir_react_1.Server className="h-6 w-6" aria-hidden="true"/>,
        title: "Full Control",
        description: "Complete control over your deployments with advanced configuration options."
    },
    {
        icon: <iconoir_react_1.Dollar className="h-6 w-6" aria-hidden="true"/>,
        title: "Pay-as-you-go",
        description: "Only pay for what you use with transparent pricing and no hidden fees."
    }
];
var FreeTrialLandingStep = function (_a) {
    var onStartTrial = _a.onStartTrial;
    return (<div className="space-y-8">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <AkashLogo_1.AkashLogo />
        </div>
        <Title_1.Title className="mb-6">Start Your Free Trial</Title_1.Title>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
          Experience the power of decentralized cloud computing with Akash Network. Deploy your applications on a global network of providers with our free
          trial.
        </p>

        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <components_1.Button size="lg" className="px-8 py-4 text-lg" onClick={onStartTrial}>
            Start Free Trial
          </components_1.Button>
        </div>

        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground">
            By starting your free trial, you agree to our{" "}
            <link_1.default href={urlUtils_1.UrlService.termsOfService()} className="text-primary hover:underline">
              Terms of Service
            </link_1.default>{" "}
            and{" "}
            <link_1.default href={urlUtils_1.UrlService.privacyPolicy()} className="text-primary hover:underline">
              Privacy Policy
            </link_1.default>
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-lg bg-muted/50 p-6">
          <ul className="space-y-2 text-left" role="list" aria-label="Free trial benefits">
            <li className="flex items-center gap-2" role="listitem">
              <iconoir_react_1.Check className="h-4 w-4 text-green-600" aria-hidden="true"/>
              <span>100$ of free credits</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <iconoir_react_1.Check className="h-4 w-4 text-green-600" aria-hidden="true"/>
              <span>30 days of free credits</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <iconoir_react_1.Check className="h-4 w-4 text-green-600" aria-hidden="true"/>
              <span>Deployments last up to 24 hours</span>
            </li>
            <li className="flex items-center gap-2" role="listitem">
              <iconoir_react_1.Check className="h-4 w-4 text-green-600" aria-hidden="true"/>
              <span>Keep unused free credits if you purchase credits</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-12 text-center text-3xl font-bold">Why Choose Akash Console?</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2" role="list" aria-label="Benefits of Akash Console">
          {benefits.map(function (benefit, index) { return (<components_1.Card key={index} className="h-full" role="listitem" aria-labelledby={"benefit-title-".concat(index)}>
              <components_1.CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden="true">
                    {benefit.icon}
                  </div>
                  <components_1.CardTitle id={"benefit-title-".concat(index)} className="text-lg">
                    {benefit.title}
                  </components_1.CardTitle>
                </div>
              </components_1.CardHeader>
              <components_1.CardContent>
                <components_1.CardDescription className="text-base">{benefit.description}</components_1.CardDescription>
              </components_1.CardContent>
            </components_1.Card>); })}
        </div>
      </div>
    </div>);
};
exports.FreeTrialLandingStep = FreeTrialLandingStep;
