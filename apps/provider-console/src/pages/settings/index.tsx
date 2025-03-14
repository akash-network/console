import { useEffect, useState } from "react";
import { Button, Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useRouter } from "next/router";
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
    appVersion: { current: string; desired: string };
    chartVersion: { current: string; desired: string };
  } | null>(null);
  const [isUpgradeStatusLoading, setIsUpgradeStatusLoading] = useState(false);
  const [isNodeUpgrading, setIsNodeUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  const { providerDetails } = useProvider();
  const { activeControlMachine } = useControlMachine();
  const [url, setUrl] = useState(() => stripProviderPrefixAndPort(providerDetails?.hostUri ?? "") || "");
  const router = useRouter();

  const isDisabled = !activeControlMachine;

  const fetchUpgradeStatus = async () => {
    if (!activeControlMachine) return;

    try {
      setIsUpgradeStatusLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: { needs_upgrade: boolean; app_version: { current: string; desired: string }; chart_version: { current: string; desired: string } } =
        await restClient.post("/network/upgrade-status", request);

      if (response) {
        setUpgradeStatus({
          needsUpgrade: response.needs_upgrade,
          appVersion: {
            current: response.app_version.current,
            desired: response.app_version.desired
          },
          chartVersion: {
            current: response.chart_version.current,
            desired: response.chart_version.desired
          }
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

      if (response) {
        setUpgradeMessage(response.message);
        setNodeUpgradeSuccess(true);

        if (response.action_id) {
          // Navigate to activity logs page with the action ID
          router.push(`/activity-logs/${response.action_id}`);
        } else {
          // If no action_id, just show success message temporarily
          setTimeout(() => setNodeUpgradeSuccess(false), 20000);
        }

        // Refresh upgrade status after a delay
        setTimeout(() => fetchUpgradeStatus(), 5000);
      }
    } catch (error) {
      console.error("Failed to upgrade Akash node:", error);
    } finally {
      setIsNodeUpgrading(false);
    }
  };

  // Helper function to determine upgrade reason
  const getUpgradeReason = () => {
    if (!upgradeStatus?.needsUpgrade) return null;

    const reasons = [];

    if (upgradeStatus.appVersion.current !== upgradeStatus.appVersion.desired) {
      reasons.push(`application version (${upgradeStatus.appVersion.current} → ${upgradeStatus.appVersion.desired})`);
    }

    if (upgradeStatus.chartVersion.current !== upgradeStatus.chartVersion.desired) {
      reasons.push(`chart version (${upgradeStatus.chartVersion.current} → ${upgradeStatus.chartVersion.desired})`);
    }

    return reasons.length > 0 ? `Update available for ${reasons.join(" and ")}` : null;
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
          <h2 className="text-xl font-semibold">Akash Node Status</h2>
          <p className="text-muted-foreground mt-2">Check and upgrade your Akash Node to the latest version.</p>

          {isUpgradeStatusLoading ? (
            <div className="mt-4 flex items-center">
              <div className="border-primary mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
              <span>Checking for upgrades...</span>
            </div>
          ) : upgradeStatus ? (
            <div className="mt-4">
              <div className="mb-4 flex gap-4">
                <div className="flex-1 rounded-md border p-3">
                  <h3 className="text-muted-foreground text-sm font-medium">Akash Node Version</h3>
                  <div className="mt-1 flex items-center">
                    <span className="text-base font-semibold">{upgradeStatus.appVersion.current}</span>
                    {upgradeStatus.appVersion.current !== upgradeStatus.appVersion.desired && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <path d="m6 9 6-6 6 6"></path>
                          <path d="M12 3v18"></path>
                        </svg>
                        {upgradeStatus.appVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 rounded-md border p-3">
                  <h3 className="text-muted-foreground text-sm font-medium">Chart Version</h3>
                  <div className="mt-1 flex items-center">
                    <span className="text-base font-semibold">{upgradeStatus.chartVersion.current}</span>
                    {upgradeStatus.chartVersion.current !== upgradeStatus.chartVersion.desired && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <path d="m6 9 6-6 6 6"></path>
                          <path d="M12 3v18"></path>
                        </svg>
                        {upgradeStatus.chartVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {upgradeStatus.needsUpgrade ? (
                <>
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 mt-0.5 text-amber-500"
                      >
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      <div>
                        <p className="font-medium text-amber-800">{getUpgradeReason()}</p>
                        {/* <p className="text-sm text-amber-700 mt-1">Upgarding may cause temporary service interruption for bid engine.</p> */}
                      </div>
                    </div>
                  </div>
                  <Button onClick={upgradeAkashNode} className="mt-2" disabled={isDisabled || isNodeUpgrading}>
                    {isNodeUpgrading ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Upgrading...
                      </>
                    ) : (
                      "Upgrade Akash Node"
                    )}
                  </Button>
                </>
              ) : (
                <div className="mb-4 rounded-md border p-3">
                  <div className="flex items-start">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 mt-0.5 text-green-500"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <div>
                      <p className="font-medium text-green-800">Your Akash Node is up to date</p>
                      <p className="mt-1 text-sm text-green-700">The upgrade button will be enabled when a new version is available.</p>
                    </div>
                  </div>
                </div>
              )}

              {nodeUpgradeSuccess && (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-green-800">{upgradeMessage || "Akash Node upgrade started successfully"}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-yellow-800">Unable to check upgrade status. Please ensure your control machine is connected.</p>
            </div>
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
