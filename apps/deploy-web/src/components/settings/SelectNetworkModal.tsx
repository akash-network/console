"use client";
import { useState } from "react";
import { MAINNET_ID } from "@akashnetwork/network-store";
import { Alert, AlertDescription, AlertTitle, Badge, buttonVariants, Popup, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import networkStore from "@src/store/networkStore";

export const SelectNetworkModal = ({ onClose }) => {
  const [selectedNetworkId, setSelectedNetworkId] = networkStore.useSelectedNetworkIdStore({ reloadOnChange: true });
  const [formSelectedNetworkId, setFormSelectedNetworkId] = useState(selectedNetworkId);

  const save = () => {
    if (selectedNetworkId !== formSelectedNetworkId) {
      setSelectedNetworkId(formSelectedNetworkId);
    }

    onClose();
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
          onClick: save
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <RadioGroup>
        <ul>
          {networkStore.networks.map(network => {
            return (
              <li
                key={network.id}
                onClick={() => setFormSelectedNetworkId(network.id)}
                className={cn(
                  buttonVariants({ variant: "text" }),
                  { ["pointer-events-none text-muted-foreground"]: !network.enabled },
                  "flex h-auto cursor-pointer items-center justify-start"
                )}
              >
                <div className="basis-[40px]">
                  <RadioGroupItem value={network.id} id={network.id} checked={formSelectedNetworkId === network.id} disabled={!network.enabled} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-lg">
                    <span>
                      <strong>{network.title}</strong>
                      {" - "}
                      <span className="text-xs text-muted-foreground">{network.version}</span>
                    </span>
                    {network.id !== MAINNET_ID && (
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

      {formSelectedNetworkId !== MAINNET_ID && (
        <Alert variant="warning" className="mb-2 mt-4">
          <AlertTitle className="font-bold">Warning</AlertTitle>

          <AlertDescription>Some features are experimental and may not work as intended on the testnet or sandbox.</AlertDescription>
        </Alert>
      )}
    </Popup>
  );
};
