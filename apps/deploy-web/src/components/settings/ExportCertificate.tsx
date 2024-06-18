"use client";
import { useEffect } from "react";
import { event } from "nextjs-google-analytics";

import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import { Popup } from "@src/components/shared/Popup";
import { Alert } from "@akashnetwork/ui/components";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useSelectedWalletFromStorage } from "@src/utils/walletUtils";

export function ExportCertificate({ isOpen, onClose }: React.PropsWithChildren<{ isOpen: boolean; onClose: () => void }>) {
  const selectedWallet = useSelectedWalletFromStorage();

  useEffect(() => {
    async function init() {
      event(AnalyticsEvents.EXPORT_CERTIFICATE, {
        category: "certificates",
        label: "Export certificate"
      });
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Popup
      fullWidth
      open={isOpen}
      variant="custom"
      title="Export certificate"
      actions={[
        {
          label: "Close",
          variant: "text",
          side: "right",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      {selectedWallet && selectedWallet.cert && selectedWallet.certKey ? (
        <div>
          <p className="mb-2 font-bold">Cert</p>
          <div className="mb-4">
            <CodeSnippet code={selectedWallet.cert} />
          </div>
          <p className="mb-2 font-bold">Key</p>
          <CodeSnippet code={selectedWallet.certKey} />
        </div>
      ) : (
        <Alert variant="warning">
          Unable to find local certificate. Meaning you have a certificate on chain but not in the tool. We suggest you regenerate a new one to be able to use
          the tool properly.
        </Alert>
      )}
    </Popup>
  );
}
