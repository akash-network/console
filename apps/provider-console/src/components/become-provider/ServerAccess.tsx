"use client";
import { Button, Input, Separator } from "@akashnetwork/ui/components";
import React, { useState, useCallback } from "react";
import { ServerForm } from "./ServerForm";
import ResetProviderForm from "./ResetProviderProcess";

interface ServerAccessProps {
  stepChange: () => void;
}

export const ServerAccess: React.FunctionComponent<ServerAccessProps> = ({ stepChange }) => {
  const [numberOfServers, setNumberOfServers] = useState(1);
  const [activateServerForm, setActivateServerForm] = useState(false);
  const [currentServer, setCurrentServer] = useState(0);

  // Callback function to handle server form submission
  const handleServerFormSubmit = useCallback(() => {
    if (currentServer + 1 >= numberOfServers) {
      stepChange();
    }
    setCurrentServer(prev => prev + 1);
  }, [currentServer, numberOfServers, stepChange]);

  // Callback function to handle changes in the number of servers input
  const handleNumberOfServersChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Ensure the number of servers is at least 1
    const value = Math.max(1, parseInt(event.target.value, 10) || 1);
    setNumberOfServers(value);
  }, []);

  return (
    <div className="flex flex-col items-center pt-10">
      {!activateServerForm ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold">Specify Number of Servers</h3>
            <p className="text-muted-foreground text-sm">Tell us how many servers you'll be using in your setup.</p>
          </div>
          <Input type="number" placeholder="1" value={numberOfServers} onChange={handleNumberOfServersChange} min={1} />
          <div className="">
            <Separator />
          </div>
          <div className="flex w-full justify-between">
            <div className="flex justify-start">
              <ResetProviderForm />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setActivateServerForm(true)}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <ServerForm key={currentServer} currentServerNumber={currentServer} onSubmit={handleServerFormSubmit} />
      )}
    </div>
  );
};