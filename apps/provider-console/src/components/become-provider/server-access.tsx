"use client";
import { Button, Input, Separator } from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { ServerForm } from "./server-form";

export const ServerAccess: React.FunctionComponent = () => {
  const [numberOfServer, setNumberOfServer] = useState<any>(1);
  const [currentServer, setCurrentServer] = useState<number>(0);

  const nextServerSetup = (nextServerNumber: number) => {
    setCurrentServer(nextServerNumber);
  };

  const renderForms = () => {
    const forms: any = [];
    for (let i = 0; i < numberOfServer; i++) {
      forms.push(<ServerForm />);
    }

    return forms;
  };
  return (
    <div className="flex flex-col items-center pt-10">
      {currentServer < 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold">Specify Number of Servers</h3>
            <p className="text-muted-foreground text-sm">Tell us how many servers you'll be using in your setup.</p>
          </div>
          <Input type="number" placeholder="1" value={numberOfServer} onChange={event => setNumberOfServer(event.target.value)} />
          <div className="">
            <Separator />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => nextServerSetup(1)}>Next</Button>
          </div>
        </div>
      )}

      {currentServer > 0 && renderForms()}
    </div>
  );
};
