import { useEffect, useRef } from "react";
import { Import } from "iconoir-react";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@src/components/ui/card";
import { Button } from "../ui/button";

const autoImportOrigin = "https://deploy.cloudmos.io";

export default function CloudmosImportPanel() {
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  async function handleMessage(ev: MessageEvent) {
    if (ev.origin !== autoImportOrigin) {
      return;
    }

    console.log(`${window.location.origin} => Received event: `, ev);

    const importDataSchema = z.record(z.string(), z.string());

    const parsedData = await importDataSchema.safeParseAsync(ev.data);

    if (!parsedData.success) {
      console.error(`${window.location.origin} => Invalid data format`, parsedData.success);
      return;
    }

    const existingKeys = Object.keys(localStorage);
    const newKeys = Object.keys(parsedData.data).filter(key => !existingKeys.includes(key));

    for (const key of newKeys) {
      localStorage.setItem(key, parsedData.data[key]);
    }

    // Merge wallet certificates
    const existingNetworkWalletKeys = Object.keys(parsedData.data).filter(key => existingKeys.includes(key) && key.endsWith("/wallets"));
    for (const networkWalletsKey of existingNetworkWalletKeys) {
      const existingWallets = JSON.parse(localStorage.getItem(networkWalletsKey)!);
      const importedWallets = JSON.parse(parsedData.data[networkWalletsKey]);
      const importedWalletsWithCert = importedWallets.filter(x => x.cert);

      for (const importedWallet of importedWalletsWithCert) {
        const existingWallet = existingWallets.find(x => x.address === importedWallet.address);

        if (existingWallet) {
          existingWallet.cert = importedWallet.cert;
          existingWallet.certKey = importedWallet.certKey;
        } else {
          existingWallets.push(importedWallet);
        }
      }

      localStorage.setItem(networkWalletsKey, JSON.stringify(existingWallets));
    }

    console.log(`${window.location.origin} => Imported ${newKeys.length} keys from ${ev.origin}`);

    if (windowRef.current) {
      windowRef.current.postMessage("DONE", { targetOrigin: autoImportOrigin });
    }

    window.location.reload();
  }

  function handleImportClick() {
    windowRef.current = popupWindow(autoImportOrigin + "/standalone/localstorage-export", window, 400, 500);
  }

  function popupWindow(url: string, win: Window, w: number, h: number) {
    const y = win.outerHeight / 2 + win.screenY - h / 2;
    const x = win.outerWidth / 2 + win.screenX - w / 2;
    return win.open(
      url,
      "_blank",
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}`
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Coming from Cloudmos?</CardTitle>
      </CardHeader>

      <CardContent>
        If you have existing data on Cloudmos, you can import it easily.
        <Button variant="default" className="ml-2" onClick={handleImportClick}>
          Import
          <Import className="ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
