"use client";
import { MouseEvent, useState } from "react";
import { BadgeCheck } from "iconoir-react";

import { ClientProviderDetailWithStatus, ClientProviderList } from "@src/types/provider";
import { Button } from "@akashnetwork/ui/components";
import { AuditorsModal } from "./AuditorsModal";

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
      <Button onClick={onAuditorClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
        <BadgeCheck className="text-sm text-green-600" fontSize="small" color="success" />
      </Button>

      {isViewingAuditors && <AuditorsModal attributes={provider.attributes || []} onClose={onClose} />}
    </>
  );
};
