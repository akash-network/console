import { Spinner } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";

export const ControlMachineStatus = () => {
  const { activeControlMachine, openControlMachineDrawer, controlMachineLoading } = useControlMachine();

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground text-sm">Control Node:</span>
      <button
        onClick={openControlMachineDrawer}
        disabled={controlMachineLoading}
        className={`rounded px-3 py-1 text-xs ${
          controlMachineLoading ? "cursor-not-allowed" : activeControlMachine ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
        }`}
      >
        {controlMachineLoading ? (
          <span className="flex items-center gap-1">
            <Spinner size="small" />
            <span>Loading...</span>
          </span>
        ) : activeControlMachine ? (
          "Disconnect"
        ) : (
          "Connect"
        )}
      </button>
    </div>
  );
};
