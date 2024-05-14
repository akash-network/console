"use client";

import { extractLocalStorageData } from "@src/utils/localStorage";
import { useEffect } from "react";

const validExternalDomain = "https://console.akash.network";

export default function Page() {
  useEffect(() => {
    exportLocalStorageData();
  }, []);

  function exportLocalStorageData() {
    if (window.parent === window) {
      console.log(`${window.location.origin} => No parent window found`);
      return;
    }

    const data = extractLocalStorageData();

    console.log(`${window.location.origin} => Sending localstorage data to ${validExternalDomain}`);
    window.parent.postMessage(data, { targetOrigin: validExternalDomain });
  }

  return (
    <div>
      <p>Exporting local storage data to {validExternalDomain}</p>
    </div>
  );
}
