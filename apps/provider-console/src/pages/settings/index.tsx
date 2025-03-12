import { useEffect, useState } from "react";
import { Button, Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { z } from "zod";

import { Layout } from "@src/components/layout/Layout";
import { ControlMachineError } from "@src/components/shared/ControlMachineError";
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
  const [restartSuccess, setRestartSuccess] = useState(false);
  const [nodeUpgradeSuccess, setNodeUpgradeSuccess] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<{
    needsUpgrade: boolean;
    currentNetworkVersion: string;
    systemVersion: string;
  } | null>(null);
  const [isUpgradeStatusLoading, setIsUpgradeStatusLoading] = useState(false);
  const [isNodeUpgrading, setIsNodeUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  const { providerDetails } = useProvider();
  const { activeControlMachine } = useControlMachine();
  const [url, setUrl] = useState(() => stripProviderPrefixAndPort(providerDetails?.hostUri ?? "") || "");

  const isDisabled = !activeControlMachine;

  const fetchUpgradeStatus = async () => {
    if (!activeControlMachine) return;

    try {
      setIsUpgradeStatusLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: { needs_upgrade: boolean; current_network_version: string; system_version: string } = await restClient.post(
        "/network/upgrade-status",
        request
      );
      console.log(response);
      if (response) {
        setUpgradeStatus({
          needsUpgrade: response.needs_upgrade,
          currentNetworkVersion: response.current_network_version,
          systemVersion: response.system_version
        });
      }
    } catch (error) {
      console.error("Failed to fetch upgrade status:", error);
    } finally {
      setIsUpgradeStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchUpgradeStatus();
  }, [activeControlMachine]);

  const handleUrlUpdate = async () => {
    try {
      urlSchema.parse(url);
      const request = {
        domain: url,
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response = await restClient.post("/update-provider-domain", request);
      if (response) {
        setRestartSuccess(true);
        setTimeout(() => setRestartSuccess(false), 20000);
      }
      setUrlError("");
    } catch (error) {
      setUrlError("Please enter a valid domain name");
    }
  };

  const restartProvider = async () => {
    try {
      setIsRestartLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response = await restClient.post("/restart-provider", request);
      if (response) {
        setRestartSuccess(true);
        setTimeout(() => setRestartSuccess(false), 20000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRestartLoading(false);
    }
  };

  const upgradeProvider = () => {
    // Original upgrade provider function
    // TODO: call upgrade provider api here
  };

  const upgradeAkashNode = async () => {
    if (!activeControlMachine || !upgradeStatus?.needsUpgrade) return;

    try {
      setIsNodeUpgrading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: { message: string; action_id: string } = await restClient.post("/network/upgrade", request);

      if (response && response) {
        setUpgradeMessage(response.message);
        setNodeUpgradeSuccess(true);
        setTimeout(() => setNodeUpgradeSuccess(false), 20000);

        // Refresh upgrade status after a delay
        setTimeout(() => fetchUpgradeStatus(), 5000);
      }
    } catch (error) {
      console.error("Failed to upgrade Akash node:", error);
    } finally {
      setIsNodeUpgrading(false);
    }
  };

  return (
    <Layout>
      <ControlMachineError className="mb-4" />
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Settings</Title>
          <p className="text-muted-foreground text-sm">
            Manage your provider settings, including restarting services, upgrading provider software, and updating your provider URL.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Restart Provider</h2>
          <p className="text-muted-foreground mt-2">Restart your provider instance. This may cause temporary service interruption.</p>
          <Button onClick={() => restartProvider()} className="mt-4" disabled={isDisabled || isRestartLoading}>
            {isRestartLoading ? "Restarting..." : "Restart Provider"}
          </Button>
          <div className="mt-4">{restartSuccess && <div className="text-green-500">Provider restarted successfully</div>}</div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Upgrade Akash Node</h2>
          <p className="text-muted-foreground mt-2">Check and upgrade your Akash Node to the latest version.</p>

          {isUpgradeStatusLoading ? (
            <p className="mt-2">Checking for upgrades...</p>
          ) : upgradeStatus ? (
            <>
              <div className="mt-2">
                <p>Network version: {upgradeStatus.currentNetworkVersion}</p>
                <p>System version: {upgradeStatus.systemVersion}</p>
              </div>
              {upgradeStatus.needsUpgrade ? (
                <Button onClick={upgradeAkashNode} className="mt-4" disabled={isDisabled || isNodeUpgrading}>
                  {isNodeUpgrading ? "Upgrading..." : `Upgrade to ${upgradeStatus.currentNetworkVersion}`}
                </Button>
              ) : (
                <p className="mt-2 text-green-500">Your Akash Node is up to date.</p>
              )}
              {nodeUpgradeSuccess && <div className="mt-4 text-green-500">{upgradeMessage || "Akash Node upgrade started successfully"}</div>}
            </>
          ) : (
            <p className="mt-2 text-yellow-500">Unable to check upgrade status.</p>
          )}
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Upgrade Provider</h2>
          <p className="text-muted-foreground mt-2">Upgrade your provider to the latest version.</p>
          <Button onClick={() => upgradeProvider()} className="mt-4" variant="outline" disabled={isDisabled}>
            Upgrade Provider
          </Button>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Provider URL</h2>
          <p className="text-muted-foreground mt-2">Update the URL for your provider service.</p>
          <div className="mt-4 flex gap-4">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={"Enter new URL"}
              error={urlError ? true : undefined}
              className={cn("min-w-[400px]")}
              disabled={isDisabled}
            />
            <Button onClick={handleUrlUpdate} disabled={isDisabled}>
              Update URL
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: SettingsPage, authLevel: "provider" });
