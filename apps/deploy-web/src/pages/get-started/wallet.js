"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var router_1 = require("next/router");
var NoKeplrSection_1 = require("@src/components/get-started/NoKeplrSection");
var NoWalletSection_1 = require("@src/components/get-started/NoWalletSection");
var WithKeplrSection_1 = require("@src/components/get-started/WithKeplrSection");
var Layout_1 = require("@src/components/layout/Layout");
var CustomNextSeo_1 = require("@src/components/shared/CustomNextSeo");
var urlUtils_1 = require("@src/utils/urlUtils");
var GetWalletSection;
(function (GetWalletSection) {
    GetWalletSection["NoWallet"] = "no-wallet";
    GetWalletSection["NoKeplr"] = "no-keplr";
    GetWalletSection["HasKeplr"] = "has-keplr";
    GetWalletSection["CreateWallet"] = "create-wallet";
})(GetWalletSection || (GetWalletSection = {}));
var GetStartedWallet = function () {
    var router = (0, router_1.useRouter)();
    // Fallback to null if the section is not valid
    var currentSection = Object.values(GetWalletSection).includes(router.query.section) ? router.query.section : null;
    var sections = [
        {
            title: "I don't have any cryptocurrencies",
            description: "No worries, we'll guide you through the process of getting your hands on some crypto to be able to deploy.",
            id: GetWalletSection.NoWallet
        },
        {
            title: "I have cryptocurrencies, but not on Keplr wallet",
            description: "Great! We'll guide you through the process of installing the Keplr wallet browser extension and swapping your way to the cosmos ecosystem.",
            id: GetWalletSection.NoKeplr
        },
        {
            title: "I have a Keplr wallet",
            description: "If you're already familiar with the cosmos ecosystem and already have a Keplr wallet, it will be super easy to acquire some AKT!",
            id: GetWalletSection.HasKeplr
        }
    ];
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title="Setup wallet" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.getStartedWallet())} description="Follow the steps to install Keplr and get tokens!"/>

      <components_1.Breadcrumb className="mb-4">
        <components_1.BreadcrumbList>
          <components_1.BreadcrumbItem>
            <components_1.BreadcrumbLink href={urlUtils_1.UrlService.getStarted()}>Get Started</components_1.BreadcrumbLink>
          </components_1.BreadcrumbItem>
          <components_1.BreadcrumbSeparator />
          <components_1.BreadcrumbItem>
            <components_1.BreadcrumbPage>Setup Wallet</components_1.BreadcrumbPage>
          </components_1.BreadcrumbItem>
        </components_1.BreadcrumbList>
      </components_1.Breadcrumb>

      <components_1.Card>
        <components_1.CardHeader>
          <components_1.CardTitle>Installing Keplr and getting AKT</components_1.CardTitle>
        </components_1.CardHeader>
        <components_1.CardContent className="mt-4 space-y-4">
          {!currentSection &&
            sections.map(function (section, index) { return (<link_1.default className="block px-4 py-2 hover:bg-muted hover:no-underline" key={index} href={urlUtils_1.UrlService.getStartedWallet(section.id)}>
                <p className="font-bold text-secondary-foreground">{section.title}</p>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </link_1.default>); })}

          {currentSection === GetWalletSection.NoWallet && <NoWalletSection_1.NoWalletSection />}
          {currentSection === GetWalletSection.NoKeplr && <NoKeplrSection_1.NoKeplrSection />}
          {currentSection === GetWalletSection.HasKeplr && <WithKeplrSection_1.WithKeplrSection />}
        </components_1.CardContent>
      </components_1.Card>
    </Layout_1.default>);
};
exports.default = GetStartedWallet;
