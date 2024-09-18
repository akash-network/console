"use client";
import { Button, Input, Separator } from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { ServerForm } from "./server-form";

interface ServerAccessProps {
  stepChange: () => void;
}

export const ServerAccess: React.FunctionComponent<ServerAccessProps> = ({ stepChange }) => {
  const [numberOfServer, setNumberOfServer] = useState<any>(1);
  const [activateServerForm, setActivateServerForm] = useState<boolean>(false);

  const [currentServer, setCurrentServer] = useState<number>(0);
  const [defaultServerDetails, setDefaultServerDetails] = useState<any>({});

  const [serverInformation, setServerInformation] = useState<any[]>([]);

  const serverFormSubmitted = () => {
    // console.log("Submitted Server", currentServer);
    // console.log("Total Server", numberOfServer);
    // console.log("Submitted data", data);
    // console.log(currentServer)

    // if (currentServer == 0) {
    //   if (data.access.saveInformation) {
    //     console.log("storing information");
    //     const savingData = data.access;
    //     savingData.ip = null;
    //     savingData.saveInformation = null;
    //     console.log(savingData)
    //     setDefaultServerDetails(savingData);
    //   }
    // }

    // const updatedServerInformation = [...serverInformation];
    // updatedServerInformation[currentServer] = data;
    // setServerInformation(updatedServerInformation);

    if (currentServer + 1 >= numberOfServer) {
      console.log("changing step");
      stepChange();
    }

    console.log("Updated Server Information", serverInformation);
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
          <div className="flex justify-end">
            <Button onClick={() => setActivateServerForm(true)}>Next</Button>
          </div>
        </div>
      )}

      {activateServerForm && (
        <ServerForm key={currentServer} currentServerNumber={currentServer} defaultValues={defaultServerDetails} onSubmit={() => serverFormSubmitted()} />
      )}
    </div>
  );
};
