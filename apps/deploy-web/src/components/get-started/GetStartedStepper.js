"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStartedStepper = void 0;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var Step_1 = require("@mui/material/Step");
var StepContent_1 = require("@mui/material/StepContent");
var StepLabel_1 = require("@mui/material/StepLabel");
var Stepper_1 = require("@mui/material/Stepper");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var AddFundsLink_1 = require("@src/components/user/AddFundsLink");
var ConnectManagedWalletButton_1 = require("@src/components/wallet/ConnectManagedWalletButton");
var browser_env_config_1 = require("@src/config/browser-env.config");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var walletStore_1 = require("@src/store/walletStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var liquidity_modal_1 = require("../liquidity-modal");
var ExternalLink_1 = require("../shared/ExternalLink");
var ConnectWalletButton_1 = require("../wallet/ConnectWalletButton");
var Stepper_2 = require("./Stepper");
var GetStartedStepper = function () {
    var _a, _b, _c;
    var _d = (0, react_1.useState)(0), activeStep = _d[0], setActiveStep = _d[1];
    var _e = (0, WalletProvider_1.useWallet)(), isWalletConnected = _e.isWalletConnected, address = _e.address, isManagedWallet = _e.isManaged, isTrialing = _e.isTrialing;
    var _f = (0, useWalletBalance_1.useWalletBalance)(), refetchBalances = _f.refetch, walletBalance = _f.balance;
    var minDeposit = (0, ChainParamProvider_1.useChainParam)().minDeposit;
    var aktBalance = walletBalance ? (0, priceUtils_1.uaktToAKT)(walletBalance.balanceUAKT) : 0;
    var usdcBalance = walletBalance ? (0, mathHelpers_1.udenomToDenom)(walletBalance.balanceUUSDC) : 0;
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var user = (0, useCustomUser_1.useCustomUser)().user;
    (0, react_1.useEffect)(function () {
        var getStartedStep = localStorage.getItem("getStartedStep");
        if (getStartedStep) {
            var _getStartedStep = parseInt(getStartedStep);
            setActiveStep(_getStartedStep >= 0 && _getStartedStep <= 2 ? _getStartedStep : 0);
        }
    }, []);
    var handleNext = function () {
        setActiveStep(function (prevActiveStep) {
            var newStep = prevActiveStep + 1;
            localStorage.setItem("getStartedStep", newStep.toString());
            return newStep;
        });
    };
    var handleReset = function () {
        setActiveStep(0);
        localStorage.setItem("getStartedStep", "0");
    };
    var onStepClick = function (step) {
        setActiveStep(step);
        localStorage.setItem("getStartedStep", step.toString());
    };
    return (<Stepper_1.default activeStep={activeStep} orientation="vertical" connector={<Stepper_2.QontoConnector />}>
      <Step_1.default>
        <StepLabel_1.default StepIconComponent={Stepper_2.QontoStepIcon} onClick={function () { return (activeStep > 0 ? onStepClick(0) : null); }} classes={{ label: (0, utils_1.cn)("text-xl tracking-tight", (_a = {}, _a["cursor-pointer hover:text-primary"] = activeStep > 0, _a["!font-bold"] = activeStep === 0, _a)) }}>
          {browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED ? "Trial / Billing" : "Billing"}
        </StepLabel_1.default>

        <StepContent_1.default>
          {browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED && !isWalletConnected && (<p className="text-muted-foreground">
              You can pay using either USD (fiat) or with crypto ($AKT or $USDC). To pay with USD click "Start Trial". To pay with crypto, click "Connect
              Wallet"
            </p>)}

          {isWalletConnected && !isManagedWallet && (<div className="my-4 flex items-center space-x-2">
              <iconoir_react_1.Check className="text-green-600"/>
              <span>Wallet is installed</span>{" "}
            </div>)}

          {!isManagedWallet && (<p className="text-muted-foreground">
              You need at least {minDeposit.akt} AKT or {minDeposit.usdc} USDC in your wallet to deploy on Akash. If you don't have {minDeposit.akt} AKT or{" "}
              {minDeposit.usdc} USDC, you can switch to the sandbox or ask help in our <ExternalLink_1.ExternalLink href="https://discord.gg/akash" text="Discord"/>.
            </p>)}

          <div className="my-4 flex items-center space-x-4">
            {isManagedWallet && (<div className="flex items-start gap-2">
                <AddFundsLink_1.AddFundsLink className={(0, utils_1.cn)("hover:no-underline", (0, components_1.buttonVariants)({ variant: "default" }))} href={urlUtils_1.UrlService.payment()}>
                  <iconoir_react_1.HandCard className="text-xs text-accent-foreground"/>
                  <span className="m-2 whitespace-nowrap text-accent-foreground">Add Funds</span>
                </AddFundsLink_1.AddFundsLink>
              </div>)}
          </div>

          <components_1.Button className="mt-4" variant="default" onClick={handleNext}>
            Next
          </components_1.Button>
          {!isManagedWallet && (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }))} href={urlUtils_1.UrlService.getStartedWallet()}>
              Learn how
            </link_1.default>)}

          {isWalletConnected && isTrialing && (<div className="my-4 flex items-center space-x-2">
              <iconoir_react_1.Check className="text-green-600"/>
              <span>Trialing</span>
            </div>)}

          {isWalletConnected && isManagedWallet && !isTrialing && (<div className="my-4 flex items-center space-x-2">
              <iconoir_react_1.Check className="text-green-600"/>
              <span>Billing is set up</span>
            </div>)}

          {!isWalletConnected && (<div>
              <div className="my-4 flex items-center space-x-2">
                <iconoir_react_1.XmarkCircleSolid className="text-destructive"/>
                <span>Billing is not set up</span>
              </div>

              <div className="flex items-center gap-2">
                {browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED && !isSignedInWithTrial && <ConnectManagedWalletButton_1.ConnectManagedWalletButton className="mr-2 w-full md:w-auto"/>}
                <ConnectWalletButton_1.ConnectWalletButton />

                {isSignedInWithTrial && !user && (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "outline" }))} href={urlUtils_1.UrlService.login()}>
                    Sign in
                  </link_1.default>)}
              </div>
            </div>)}

          {walletBalance && (<div className="my-4 flex items-center space-x-2">
              {aktBalance >= minDeposit.akt || usdcBalance >= minDeposit.usdc ? (<iconoir_react_1.Check className="text-green-600"/>) : (<components_1.CustomTooltip title={<>
                      If you don&apos;t have {minDeposit.akt} AKT or {minDeposit.usdc} USDC, you can request authorization for some tokens to get started on our{" "}
                      <ExternalLink_1.ExternalLink href="https://discord.gg/akash" text="Discord"/>.
                    </>}>
                  <iconoir_react_1.WarningCircle className="text-warning"/>
                </components_1.CustomTooltip>)}
              {isManagedWallet ? (<span>
                  You have <strong>${usdcBalance}</strong>
                </span>) : (<span>
                  You have <strong>{aktBalance}</strong> AKT and <strong>{usdcBalance}</strong> USDC
                </span>)}
              {!isManagedWallet && isWalletConnected && <liquidity_modal_1.default address={address} aktBalance={aktBalance} refreshBalances={refetchBalances}/>}
            </div>)}
        </StepContent_1.default>
      </Step_1.default>

      <Step_1.default>
        <StepLabel_1.default StepIconComponent={Stepper_2.QontoStepIcon} onClick={function () { return onStepClick(1); }} classes={{
            label: (0, utils_1.cn)("text-xl tracking-tight", (_b = {},
                _b["cursor-pointer hover:text-primary"] = activeStep > 1,
                _b["!font-bold"] = activeStep === 1,
                _b))
        }}>
          Docker container
        </StepLabel_1.default>
        <StepContent_1.default>
          <p className="mb-2 text-muted-foreground">
            To deploy on Akash, you need a docker container image as everything runs within Kubernetes. You can make your own or browse through pre-made
            solutions in the marketplace.
          </p>

          <p className="text-muted-foreground">For the sake of getting started, we will deploy a simple Next.js app that you can find in the deploy page.</p>
          <div className="my-4 flex flex-col flex-wrap items-start space-y-4 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
            <components_1.Button variant="default" onClick={handleNext}>
              Next
            </components_1.Button>

            <div>
              <ExternalLink_1.ExternalLink href="https://docs.docker.com/get-started/" text="Learn how"/>
            </div>

            <link_1.default href={urlUtils_1.UrlService.templates()} className={(0, utils_1.cn)("py-4", (0, components_1.buttonVariants)({ variant: "secondary" }))}>
              Explore Marketplace
            </link_1.default>
          </div>
        </StepContent_1.default>
      </Step_1.default>

      <Step_1.default>
        <StepLabel_1.default StepIconComponent={Stepper_2.QontoStepIcon} classes={{ label: (0, utils_1.cn)("text-xl tracking-tight", (_c = {}, _c["!font-bold"] = activeStep === 2, _c)) }}>
          Hello world
        </StepLabel_1.default>
        <StepContent_1.default>
          <p className="text-muted-foreground">
            Deploy your first web app on Akash! This is a simple Next.js app and you can see the{" "}
            <ExternalLink_1.ExternalLink href="https://github.com/akash-network/hello-akash-world" text="source code here"/>.
          </p>
          <div className="my-4 space-x-2">
            <link_1.default className={(0, utils_1.cn)("space-x-2", (0, components_1.buttonVariants)({ variant: "default" }))} href={urlUtils_1.UrlService.newDeployment({ templateId: "hello-world", step: route_steps_type_1.RouteStep.editDeployment })}>
              <span>Deploy!</span>
              <iconoir_react_1.Rocket className="rotate-45"/>
            </link_1.default>

            <components_1.Button onClick={handleReset} className="space-x-2" variant="ghost">
              <span>Reset</span>
              <md_1.MdRestartAlt />
            </components_1.Button>
          </div>
        </StepContent_1.default>
      </Step_1.default>
    </Stepper_1.default>);
};
exports.GetStartedStepper = GetStartedStepper;
