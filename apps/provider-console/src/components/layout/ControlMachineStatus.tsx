import { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

export const ControlMachineStatus = () => {
  const { activeControlMachine, openControlMachineDrawer, controlMachineLoading, disconnectControlMachine } = useControlMachine();
  const [showDisconnect, setShowDisconnect] = useState(false);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-foreground text-sm">Control Node:</span>
      {activeControlMachine ? (
        <div className="relative" onMouseEnter={() => setShowDisconnect(true)} onMouseLeave={() => setShowDisconnect(false)}>
          {showDisconnect ? (
            <Button onClick={disconnectControlMachine} className="min-w-[90px] px-3 py-1 text-xs" variant="destructive" size="xs">
              Disconnect
            </Button>
          ) : (
            <span className="inline-block min-w-[90px] text-sm text-green-500">Connected</span>
          )}
        </div>
      ) : (
        <Button
          onClick={openControlMachineDrawer}
          disabled={controlMachineLoading}
          className={`min-w-[90px] px-3 py-1 text-xs ${controlMachineLoading ? "cursor-not-allowed" : ""}`}
          variant="default"
          size="xs"
        >
          {controlMachineLoading ? (
            <span className="flex items-center gap-1">
              <Spinner size="xSmall" />
            </span>
          ) : (
            "Connect"
          )}
        </Button>
      )}
    </div>
  );
};
