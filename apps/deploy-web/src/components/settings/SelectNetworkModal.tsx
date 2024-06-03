"use client";
import { useState } from "react";

import { Popup } from "@src/components/shared/Popup";
import { Alert, AlertDescription, AlertTitle } from "@src/components/ui/alert";
import { Badge } from "@src/components/ui/badge";
import { buttonVariants } from "@src/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@src/components/ui/radio-group";
import { useSettings } from "@src/context/SettingsProvider";
import { networks } from "@src/store/networkStore";
import { mainnetId } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";

export const SelectNetworkModal = ({ onClose }) => {
  const { selectedNetworkId } = useSettings();
  const [localSelectedNetworkId, setLocalSelectedNetworkId] = useState(selectedNetworkId);

  const handleSelectNetwork = network => {
    setLocalSelectedNetworkId(network.id);
  };

  const handleSaveChanges = () => {
    if (selectedNetworkId !== localSelectedNetworkId) {
      // Set in the settings and local storage
      localStorage.setItem("selectedNetworkId", localSelectedNetworkId);
      // Reset the ui to reload the settings for the currently selected network

      location.reload();
    } else {
      onClose();
    }
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Select Network"
      actions={[
        {
          label: "Close",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Save",
          variant: "default",
          side: "right",
          onClick: handleSaveChanges
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <RadioGroup>
        <ul>
          {networks.map(network => {
            return (
              <li
                key={network.id}
                onClick={() => handleSelectNetwork(network)}
                className={cn(
                  buttonVariants({ variant: "text" }),
                  { ["text-muted-foreground pointer-events-none"]: !network.enabled },
                  "flex h-auto cursor-pointer items-center justify-start"
                )}
              >
                <div className="basis-[40px]">
                  <RadioGroupItem value={network.id} id={network.id} checked={localSelectedNetworkId === network.id} disabled={!network.enabled} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-lg">
                    <span>
                      <strong>{network.title}</strong>
                      {" - "}
                      <span className="text-muted-foreground text-xs">{network.version}</span>
                    </span>
                    {network.id !== mainnetId && (
                      <Badge className={cn("ml-4 h-4 text-xs font-bold", { ["bg-primary/30"]: !network.enabled })}>Experimental</Badge>
                    )}
                  </div>
                  <div>{network.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </RadioGroup>

      {localSelectedNetworkId !== mainnetId && (
        <Alert variant="warning" className="mb-2 mt-4">
          <AlertTitle className="font-bold">Warning</AlertTitle>

          <AlertDescription>Some features are experimental and may not work as intented on the testnet or sandbox.</AlertDescription>
        </Alert>
      )}
    </Popup>
  );
};
