import { Button, Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

export const ControlMachineStatus = () => {
  const { activeControlMachine, openControlMachineDrawer, controlMachineLoading } = useControlMachine();

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground text-sm">Control Node:</span>
      {activeControlMachine ? (
        <span className="text-sm text-green-500">Connected</span>
      ) : (
        <Button
          onClick={openControlMachineDrawer}
          disabled={controlMachineLoading}
          className={`px-3 py-1 text-xs ${controlMachineLoading ? "cursor-not-allowed" : ""}`}
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
