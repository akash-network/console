import { cx } from "@emotion/css";
import { Box, Button, Paper, Step, StepContent, StepLabel, Stepper, Typography } from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { LinkTo } from "../shared/LinkTo";
import { QontoConnector, QontoStepIcon } from "./Stepper";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { ExternalLink } from "../shared/ExternalLink";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { uaktToAKT } from "@src/utils/priceUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { RouteStepKeys } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";

const useStyles = makeStyles()(theme => ({
  stepLabel: {
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  activeLabel: {
    cursor: "pointer",
    "&:hover": {
      color: theme.palette.secondary.main
    }
  }
}));

type Props = {};

export const GetStartedStepper: React.FunctionComponent<Props> = () => {
  const { classes } = useStyles();
  const [activeStep, setActiveStep] = useState(0);
  const { isKeplrInstalled, isKeplrConnected, walletBalances } = useKeplr();
  const aktBalance = walletBalances ? uaktToAKT(walletBalances.uakt) : null;
  const usdcBalance = walletBalances ? udenomToDenom(walletBalances.usdc) : null;

  useEffect(() => {
    const getStartedStep = localStorage.getItem("getStartedStep");

    if (getStartedStep) {
      const _getStartedStep = parseInt(getStartedStep);
      setActiveStep(_getStartedStep >= 0 && _getStartedStep <= 2 ? _getStartedStep : 0);
    }
  }, []);

  const handleNext = () => {
    setActiveStep(prevActiveStep => {
      const newStep = prevActiveStep + 1;

      localStorage.setItem("getStartedStep", newStep.toString());

      return newStep;
    });
  };

  const handleReset = () => {
    setActiveStep(0);
    localStorage.setItem("getStartedStep", "0");
  };

  const onStepClick = (step: number) => {
    setActiveStep(step);

    localStorage.setItem("getStartedStep", step.toString());
  };

  return (
    <Stepper activeStep={activeStep} orientation="vertical" connector={<QontoConnector />}>
      <Step>
        <StepLabel
          StepIconComponent={QontoStepIcon}
          onClick={() => (activeStep > 0 ? onStepClick(0) : null)}
          classes={{ label: cx(classes.stepLabel, { [classes.activeLabel]: activeStep > 0 }) }}
        >
          Keplr wallet
        </StepLabel>

        <StepContent>
          <Typography variant="body2" color="textSecondary">
            You need at least 5 AKT or USDC in your wallet to deploy on Akash. If you don't have 5 AKT or USDC, you can request for some tokens to get started
            on our <ExternalLink href="https://discord.gg/akash" text="Discord" />.
          </Typography>

          <Box sx={{ mt: 1, mb: 2, display: "flex", alignItems: "center" }}>
            <Button variant="contained" color="secondary" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
              Next
            </Button>
            <Box component={Link} href={UrlService.getStartedWallet()} sx={{ marginLeft: "1rem" }}>
              Learn how
            </Box>
          </Box>

          {!isKeplrInstalled && (
            <Box sx={{ display: "flex", alignItems: "center", margin: "1rem 0" }}>
              <CancelIcon color="error" sx={{ marginRight: ".5rem" }} />
              Keplr is not installed
            </Box>
          )}

          {isKeplrInstalled && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", margin: "1rem 0" }}>
                <CheckIcon color="success" sx={{ marginRight: ".5rem" }} />
                Keplr is installed
              </Box>

              {isKeplrConnected ? (
                <Box sx={{ display: "flex", alignItems: "center", margin: "1rem 0" }}>
                  <CheckIcon color="success" sx={{ marginRight: ".5rem" }} />
                  Keplr is connected
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", margin: "1rem 0" }}>
                    <CancelIcon color="error" sx={{ marginRight: ".5rem" }} />
                    Keplr is not connected
                  </Box>

                  <ConnectWalletButton />
                </Box>
              )}

              {walletBalances && (
                <Box sx={{ display: "flex", alignItems: "center", margin: "1rem 0" }}>
                  {aktBalance >= 5 || usdcBalance >= 5 ? (
                    <CheckIcon color="success" sx={{ marginRight: ".5rem" }} />
                  ) : (
                    <CustomTooltip
                      title={
                        <>
                          If you don't have 5 AKT or USDC, you can request authorization for some tokens to get started on our{" "}
                          <ExternalLink href="https://discord.gg/akash" text="Discord" />.
                        </>
                      }
                    >
                      <WarningIcon color="warning" sx={{ marginRight: ".5rem" }} />
                    </CustomTooltip>
                  )}
                  You have {aktBalance} AKT and {usdcBalance} USDC
                </Box>
              )}
            </>
          )}
        </StepContent>
      </Step>

      <Step>
        <StepLabel
          StepIconComponent={QontoStepIcon}
          onClick={() => onStepClick(1)}
          classes={{ label: cx(classes.stepLabel, { [classes.activeLabel]: activeStep > 1 }) }}
        >
          Docker container
        </StepLabel>
        <StepContent>
          <Typography sx={{ mb: 2 }} variant="body2" color="textSecondary">
            To deploy on Akash, you need a docker container image as everything runs within Kubernetes. You can make your own or browse through pre-made
            solutions in the marketplace.
          </Typography>

          <Typography variant="body2" color="textSecondary">
            For the sake of getting started, we will deploy a simple Next.js app that you can find in the deploy page.
          </Typography>
          <Box sx={{ mt: 1, mb: 2, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="contained" color="secondary" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
              Next
            </Button>

            <Box component="span" sx={{ marginLeft: "1rem" }}>
              <ExternalLink href="https://docs.docker.com/get-started/" text="Learn how" />
            </Box>

            <Box href={UrlService.templates()} component={Link} sx={{ marginLeft: "1rem", padding: "1rem 0" }}>
              Explore Marketplace
            </Box>
          </Box>
        </StepContent>
      </Step>

      <Step>
        <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: classes.stepLabel }}>
          Hello world
        </StepLabel>
        <StepContent>
          <Typography variant="body2" color="textSecondary">
            Deploy your first web app on Akash! This is a simple Next.js app and you can see the{" "}
            <ExternalLink href="https://github.com/maxmaxlabs/hello-akash-world" text="source code here" />.
          </Typography>
          <Box sx={{ mb: 2, mt: 2 }}>
            <Button
              component={Link}
              href={UrlService.newDeployment({ templateId: "hello-world", step: RouteStepKeys.editDeployment })}
              variant="contained"
              endIcon={<RocketLaunchIcon />}
              color="secondary"
            >
              Deploy!
            </Button>

            <Button onClick={handleReset} sx={{ ml: 2 }} endIcon={<RestartAltIcon />}>
              Reset
            </Button>
          </Box>
        </StepContent>
      </Step>
    </Stepper>
  );
};
