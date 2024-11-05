"use client";

import React, { useEffect, useState } from "react";
import { Button, Drawer, DrawerContent, DrawerTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useAtom } from "jotai";

import { ServerForm } from "@src/components/become-provider/ServerForm";
import controlMachineStore from "@src/store/controlMachineStore";
import { ControlMachineWithAddress } from "@src/types/controlMachine";
import restClient from "@src/utils/restClient";
import { useWallet } from "../WalletProvider";

type Props = {
  children: React.ReactNode;
};

type ContextType = {
  activeControlMachine: ControlMachineWithAddress | null;
  setControlMachine: (controlMachine: ControlMachineWithAddress) => void;
  openControlMachineDrawer: () => void;
};

const ControlMachineContext = React.createContext<ContextType>({} as ContextType);

export function ControlMachineProvider({ children }: Props) {
  const [controlMachines, setControlMachines] = useAtom(controlMachineStore.controlMachineAtom);
  const [activeControlMachine, setActiveControlMachine] = useState<ControlMachineWithAddress | null>(null);
  const { address, isWalletArbitrarySigned, isProvider } = useWallet();
  const [controlMachineDrawerOpen, setControlMachineDrawerOpen] = useState(false);

  useEffect(() => {
    console.log("isWalletArbitrarySigned", isWalletArbitrarySigned);
    if (isWalletArbitrarySigned || isProvider) {
      console.log("controlMachines", controlMachines);
      const controlMachine = controlMachines.find(machine => machine.address === address);

      if (!controlMachine) {
        return;
      }

      // first check control machine connection
      (async () => {
        const request = {
          keyfile: controlMachine.access.file,
          hostname: controlMachine.access.hostname,
          port: controlMachine.access.port,
          username: controlMachine.access.username,
          password: controlMachine.access.password
        };
        const isControlMachineConnected = await restClient.post(`/verify/control-machine`, request);
        if (isControlMachineConnected) {
          setActiveControlMachine(controlMachine);
        }
      })();
    }
  }, [isWalletArbitrarySigned, address, controlMachines, isProvider]);

  async function setControlMachine(controlMachine: ControlMachineWithAddress) {
    setControlMachines(prev => {
      const existingIndex = prev.findIndex(machine => machine.address === controlMachine.address);
      if (existingIndex !== -1) {
        // Update existing control machine
        const updated = [...prev];
        updated[existingIndex] = controlMachine;
        return updated;
      }
      // Add new control machine if none exists with this address
      return [...prev, controlMachine];
    });
    setActiveControlMachine(controlMachine);
  }

  async function openControlMachineDrawer() {
    setControlMachineDrawerOpen(true);
  }

  return (
    <ControlMachineContext.Provider value={{ activeControlMachine, setControlMachine, openControlMachineDrawer }}>
      <>
        {children}
        <Drawer open={controlMachineDrawerOpen} onOpenChange={setControlMachineDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline">Edit Profile</Button>
          </DrawerTrigger>
          <DrawerContent className="z-[200] mb-10 flex items-center">
            <div className={cn("flex max-w-[500px] justify-center")}>
              <ServerForm currentServerNumber={0} onSubmit={() => {}} editMode={true} controlMachine={activeControlMachine} />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    </ControlMachineContext.Provider>
  );
}

export function useControlMachine() {
  return { ...React.useContext(ControlMachineContext) };
}
