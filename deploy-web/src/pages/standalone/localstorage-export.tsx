"use client";

import Button from "@mui/material/Button";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { extractLocalStorageData } from "@src/utils/localStorage";
import { useEffect, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorIcon from "@mui/icons-material/Error";
import Head from "next/head";

const validExternalDomain = "https://console.akash.network";

export default function Page() {
  const [state, setState] = useState<"loading" | "authorization" | "done" | "error">("authorization");
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  function handleMessage(event: MessageEvent) {
    if (event.origin !== validExternalDomain) {
      return;
    }

    if (event.data === "DONE") {
      setState("done");

      setTimeout(() => {
        window.close();
      }, 1_000);
    }
  }

  function exportLocalStorageData() {
    try {
      setState("loading");

      const data = extractLocalStorageData();

      console.log(`Sending localstorage data to ${validExternalDomain}`);
      window.opener.postMessage(data, { targetOrigin: validExternalDomain });
    } catch (e) {
      setState("error");
      console.error(e);
    }
  }

  return (
    <>
      <Head>
        <title>Cloudmos Import</title>
      </Head>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: "300px", marginBottom: "20px" }}>
          <img src="/android-chrome-192x192.png" width={100} alt="Cloudmos Logo" />
          <ArrowForwardIcon fontSize="large" />
          <img src="/images/akash-192x192.png" width={100} alt="Akash Logo" />
        </div>
        {state === "loading" && (
          <div style={{ marginTop: "50px", textAlign: "center" }}>
            <CircularProgress size="100px" color="secondary" />
            <p>Importing into Akash Console</p>
          </div>
        )}
        {state === "done" && (
          <div style={{ marginTop: "50px", textAlign: "center" }}>
            <CheckCircleOutlineIcon style={{ fontSize: "100px" }} color="success" />
            <p>Import complete</p>
          </div>
        )}

        {state === "error" && (
          <div style={{ marginTop: "50px", textAlign: "center" }}>
            <ErrorIcon style={{ fontSize: "100px" }} color="error" />
            <p>An error occured</p>
          </div>
        )}
        {state === "authorization" && (
          <>
            <div style={{ marginTop: "30px" }}>
              Import data into <strong>Akash Console</strong>
            </div>
            <ul>
              <li>Certificates</li>
              <li>Deployment Names & SDL</li>
              <li>Favorite Providers</li>
            </ul>
            <div style={{ marginTop: "30px", width: "300px" }}>
              <Button onClick={exportLocalStorageData} variant="contained" color="secondary" size="large" fullWidth>
                Import
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
