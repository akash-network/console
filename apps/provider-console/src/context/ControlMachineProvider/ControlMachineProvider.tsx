"use client";

import React, { useEffect, useState } from "react";
import { Drawer, DrawerContent } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useAtom } from "jotai";

import { ServerForm } from "@src/components/become-provider/ServerForm"; // eslint-disable-line import-x/no-cycle
import controlMachineStore from "@src/store/controlMachineStore";
import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import { migrateControlMachineStorage } from "@src/utils/migrateMachineStorage";
import restClient from "@src/utils/restClient";
import { useWallet } from "../WalletProvider";

type Props = {
  children: React.ReactNode;
};

type ContextType = {
  activeControlMachine: ControlMachineWithAddress | null;
  setControlMachine: (controlMachine: ControlMachineWithAddress) => void;
  openControlMachineDrawer: () => void;
  controlMachineLoading: boolean;
  disconnectControlMachine: () => void;
};

const ControlMachineContext = React.createContext<ContextType>({} as ContextType);

export function ControlMachineProvider({ children }: Props) {
  const [controlMachineLoading, setControlMachineLoading] = useState(false);
  const [controlMachines, setControlMachines] = useAtom(controlMachineStore.controlMachineAtom);
  const [activeControlMachine, setActiveControlMachine] = useState<ControlMachineWithAddress | null>(null);
  const { address, isWalletArbitrarySigned, isProvider } = useWallet();
  const [controlMachineDrawerOpen, setControlMachineDrawerOpen] = useState(false);

  // Run storage migration on mount to handle legacy format
  useEffect(() => {
    migrateControlMachineStorage();
  }, []);

  useEffect(() => {
    if (isWalletArbitrarySigned || isProvider) {
      setActiveControlMachine(null);
      const controlMachine = controlMachines.find(machine => machine.address === address);

      if (!controlMachine) {
        return;
      }

      (async () => {
        try {
          setControlMachineLoading(true);
          const request = {
            // Use keyfile instead of file for SSH key content
            keyfile: controlMachine.access.keyfile,
            hostname: controlMachine.access.hostname,
            port: controlMachine.access.port,
            username: controlMachine.access.username,
            password: controlMachine.access.password,
            passphrase: controlMachine.access.passphrase
          };
          const isControlMachineConnected = await restClient.post(`/verify/control-machine`, request);
          if (isControlMachineConnected) {
            setActiveControlMachine(controlMachine);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setControlMachineLoading(false);
        }
      })();
    } else if (!address) {
      setActiveControlMachine(null);
    }
  }, [isWalletArbitrarySigned, address, controlMachines, isProvider]);

  async function setControlMachine(controlMachine: ControlMachineWithAddress) {
    setControlMachines(prev => {
      const existingIndex = prev.findIndex(machine => machine.address === controlMachine.address);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = controlMachine;
        return updated;
      }
      return [...prev, controlMachine];
    });
    setControlMachineDrawerOpen(false);
    setActiveControlMachine(controlMachine);
  }

  async function openControlMachineDrawer() {
    setControlMachineDrawerOpen(true);
  }

  function disconnectControlMachine() {
    if (activeControlMachine && address) {
      setControlMachines(prev => prev.filter(machine => machine.address !== address));
    }
    setActiveControlMachine(null);
  }

  return (
    <ControlMachineContext.Provider
      value={{
        activeControlMachine,
        setControlMachine,
        openControlMachineDrawer,
        controlMachineLoading,
        disconnectControlMachine
      }}
    >
      <>
        {children}
        <Drawer open={controlMachineDrawerOpen} onOpenChange={setControlMachineDrawerOpen}>
          {/* <DrawerTrigger asChild>
            <Button variant="outline">Edit Profile</Button>
          </DrawerTrigger> */}
          <DrawerContent className="z-[200] flex items-center">
            <div className={cn("mb-10 flex max-w-[500px] justify-center")}>
              <ServerForm _currentServerNumber={0} onComplete={() => {}} editMode={true} controlMachine={activeControlMachine} />
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
