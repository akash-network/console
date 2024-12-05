"use client";
import React, { useCallback, useState } from "react";
import { Button, Input, Separator } from "@akashnetwork/ui/components";

import { ServerForm } from "./ServerForm";

interface ServerAccessProps {
  onComplete: () => void;
}

export const ServerAccess: React.FC<ServerAccessProps> = ({ onComplete }) => {
  const [numberOfServers, setNumberOfServers] = useState(1);
  const [activateServerForm, setActivateServerForm] = useState(false);
  const [currentServer, setCurrentServer] = useState(0);

  const handleServerFormSubmit = useCallback(() => {
    if (currentServer + 1 >= numberOfServers) {
      onComplete();
    }
    setCurrentServer(prev => prev + 1);
  }, [currentServer, numberOfServers, onComplete]);

  const handleNumberOfServersChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(event.target.value, 10) || 1);
    setNumberOfServers(value);
  }, []);

  return (
    <div className="flex flex-col items-center pt-10">
      {!activateServerForm ? (
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-bold">Server Count</h3>
            <Input
              type="number"
              placeholder="1"
              value={numberOfServers}
              onChange={handleNumberOfServersChange}
              min={1}
              className="w-20 rounded-md border-2 text-center"
            />
          </div>
          <p className="text-sm">
            How many servers will you be using to set up this provider? <br />
            (Include all nodes - control nodes, etcd, worker nodes)
          </p>
          <div className="">
            <Separator />
          </div>
          <div className="flex w-full justify-between">
            <div className="flex justify-start"></div>
            <div className="flex justify-end">
              <Button onClick={() => setActivateServerForm(true)}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <ServerForm key={currentServer} currentServerNumber={currentServer} onComplete={handleServerFormSubmit} />
      )}
    </div>
  );
};
