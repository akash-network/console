"use client";
import { useState, MouseEvent } from "react";
import { AuditorsModal } from "./AuditorsModal";
import { ClientProviderDetailWithStatus, ClientProviderList } from "@src/types/provider";
import { Button } from "../ui/button";
import { BadgeCheck } from "iconoir-react";

type Props = {
  provider: ClientProviderList | Partial<ClientProviderDetailWithStatus>;
};

export const AuditorButton: React.FunctionComponent<Props> = ({ provider }) => {
  const [isViewingAuditors, setIsViewingAuditors] = useState(false);

  const onAuditorClick = event => {
    event.preventDefault();
    event.stopPropagation();

    setIsViewingAuditors(true);
  };

  const onClose = (event?: MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();

    setIsViewingAuditors(false);
  };

  return (
    <>
      <Button onClick={onAuditorClick} size="icon" className="rounded-full w-8 h-8" variant="ghost">
        <BadgeCheck className="text-sm text-green-600" fontSize="small" color="success" />
      </Button>

      {isViewingAuditors && <AuditorsModal attributes={provider.attributes || []} onClose={onClose} />}
    </>
  );
};
