import { Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

export const ControlMachineStatus = () => {
  const { activeControlMachine, openControlMachineDrawer, controlMachineLoading } = useControlMachine();

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground text-sm">Control Node:</span>
      {activeControlMachine ? (
        <span className="text-green-500">Connected</span>
      ) : (
        <button
          onClick={openControlMachineDrawer}
          disabled={controlMachineLoading}
          className={`rounded px-3 py-1 text-xs ${controlMachineLoading ? "cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
        >
          {controlMachineLoading ? (
            <span className="flex items-center gap-1">
              <Spinner size="small" />
              <span>Loading...</span>
            </span>
          ) : (
            "Connect"
          )}
        </button>
      )}
    </div>
  );
};
