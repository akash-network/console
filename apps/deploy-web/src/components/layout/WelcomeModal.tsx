"use client";
import { Card, CardContent } from "@akashnetwork/ui/components";
import { useTheme } from "next-themes";

import { AkashConsoleBetaLogoDark, AkashConsoleBetaLogoLight } from "../icons/AkashConsoleLogo";
import { Popup } from "../shared/Popup";
import { Title } from "../shared/Title";

export const WelcomeModal = ({ open, onClose }) => {
  const { resolvedTheme } = useTheme();
  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      actions={[
        {
          label: "I accept",
          variant: "default",
          side: "right",
          onClick: onClose,
          "data-testid": "welcome-modal-accept-button"
        }
      ]}
      maxWidth="sm"
      hideCloseButton
    >
      <div className="mb-4 flex items-center justify-between">
        <Title>Welcome!</Title>
        {resolvedTheme === "light" ? (
          <AkashConsoleBetaLogoLight className="h-[19px] max-w-[200px]" />
        ) : (
          <AkashConsoleBetaLogoDark className="h-[19px] max-w-[200px]" />
        )}
      </div>
      <Card className="bg-background">
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Thank you for choosing Akash Console!</p>
          <br />
          <p className="text-muted-foreground">
            We hope you enjoy using our platform and look forward to continuing to provide you with excellent service. We are excited to have you as a user and
            look forward to helping you build your business.
          </p>
          <Title subTitle className="my-4 !text-lg">
            Disclaimer
          </Title>

          <p className="text-muted-foreground">
            Our app is currently in the BETA stage, which means that we are still in the process of testing and improving it. To ensure a safe and enjoyable
            experience, we recommend that you create a new wallet and start with a small amount of AKT/USDC.
            <br />
            <br />
            Please note that while we are doing our best to make sure the app is safe and functional, there may be some bugs and issues that we haven't
            discovered yet. As with any BETA product, use at your own discretion.
            <br />
            <br />
            We appreciate your understanding and support as we work to make Akash Console even better. If you encounter any problems or have suggestions for
            improvement, please don't hesitate to reach out to us. We're here to help!
          </p>
        </CardContent>
      </Card>
    </Popup>
  );
};
