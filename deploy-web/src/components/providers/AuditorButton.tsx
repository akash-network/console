import { useState, MouseEvent } from "react";
import SecurityIcon from "@mui/icons-material/Security";
import { IconButton } from "@mui/material";
import { AuditorsModal } from "./AuditorsModal";
import { ClientProviderDetailWithStatus, ClientProviderList } from "@src/types/provider";

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
      <IconButton onClick={onAuditorClick} size="small">
        <SecurityIcon fontSize="small" color="secondary" />
      </IconButton>

      {isViewingAuditors && <AuditorsModal attributes={provider.attributes} onClose={onClose} />}
    </>
  );
};
