"use client";
import { Button, Input, Separator } from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { ServerForm } from "./server-form";
import ResetProviderForm from "./reset-provider-form";

interface ServerAccessProps {
  stepChange: () => void;
}

export const ServerAccess: React.FunctionComponent<ServerAccessProps> = ({ stepChange }) => {
  const [numberOfServer, setNumberOfServer] = useState<any>(1);
  const [activateServerForm, setActivateServerForm] = useState<boolean>(false);
  const [currentServer, setCurrentServer] = useState<number>(0);

  const serverFormSubmitted = () => {
    if (currentServer + 1 >= numberOfServer) {
      console.log("changing step");
      stepChange();
    }

    setCurrentServer(currentServer + 1);
  };

  return (
    <div className="flex flex-col items-center pt-10">
      {!activateServerForm && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold">Specify Number of Servers</h3>
            <p className="text-muted-foreground text-sm">Tell us how many servers you'll be using in your setup.</p>
          </div>
          <Input type="number" placeholder="1" value={numberOfServer} onChange={event => setNumberOfServer(event.target.value)} />
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
      )}

      {activateServerForm && <ServerForm key={currentServer} currentServerNumber={currentServer} onSubmit={() => serverFormSubmitted()} />}
    </div>
  );
};
