import { useState } from "react";
import { Alert, Button, Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { z } from "zod";

import { Layout } from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useProvider } from "@src/context/ProviderContext";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { stripProviderPrefixAndPort } from "@src/utils/urlUtils";

const urlSchema = z.string().refine(value => {
  const regex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
  return regex.test(value);
}, "Invalid domain name format");

const SettingsPage: React.FC = () => {
  const [urlError, setUrlError] = useState("");
  const [isRestartLoading, setIsRestartLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { providerDetails } = useProvider();
  const { activeControlMachine } = useControlMachine();
  const [url, setUrl] = useState(() => stripProviderPrefixAndPort(providerDetails?.hostUri) || "");

  const handleUrlUpdate = async () => {
    try {
      urlSchema.parse(url);
      const request = {
        domain: url,
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response = await restClient.post("/update-provider-domain", request);
      if (response) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 20000);
      }
      setUrlError("");
    } catch (error) {
      setUrlError("Please enter a valid domain name");
    }
  };

  const restartProvider = async () => {
    // call api here
    try {
      setIsRestartLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response = await restClient.post("/restart-provider", request);
      if (response) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 20000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRestartLoading(false);
    }
  };

  const upgradeProvider = () => {
    // call api here
  };

  if (!activeControlMachine) {
    return (
      <Layout>
        <Alert>Please update control machine before accessing provider settings</Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Settings</Title>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Restart Provider</h2>
          <p className="mt-2 text-gray-600">Restart your provider instance. This may cause temporary service interruption.</p>
          <Button onClick={() => restartProvider()} className="mt-4" disabled={isRestartLoading}>
            {isRestartLoading ? "Restarting..." : "Restart Provider"}
          </Button>
          <div className="mt-4">{showSuccess && <div className="text-green-500">Provider restarted successfully</div>}</div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Upgrade Provider</h2>
          <p className="mt-2 text-gray-600">Upgrade your provider to the latest version.</p>
          <Button onClick={() => upgradeProvider()} className="mt-4" variant="outline">
            Upgrade Provider
          </Button>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Provider URL</h2>
          <p className="mt-2 text-gray-600">Update the URL for your provider service.</p>
          <div className="mt-4 flex gap-4">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={"Enter new URL"}
              error={urlError ? true : undefined}
              className={cn("min-w-[400px]")}
            />
            <Button onClick={handleUrlUpdate}>Update URL</Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: SettingsPage, authLevel: "provider" });
