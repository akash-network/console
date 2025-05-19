import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Input, Popup } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CheckCircle, Refresh, WarningTriangle } from "iconoir-react";
import { useRouter } from "next/router";
import { z } from "zod";

import { Layout } from "@src/components/layout/Layout";
import { ControlMachineError } from "@src/components/shared/ControlMachineError";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useProvider } from "@src/context/ProviderContext";
import { useKubeNodesQuery } from "@src/queries/useKubeNodesQuery";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { stripProviderPrefixAndPort } from "@src/utils/urlUtils";

const urlSchema = z.string().refine(value => {
  const regex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
  return regex.test(value);
}, "Invalid domain name format");

const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address")
  .max(254, "Email is too long")
  .refine(email => email.trim() === email, "Email cannot start or end with spaces");

const SettingsPage: React.FC = () => {
  const [urlError, setUrlError] = useState("");
  const [isRestartLoading, setIsRestartLoading] = useState(false);
  const [restartSuccess, setRestartSuccess] = useState(false);
  const [nodeUpgradeSuccess, setNodeUpgradeSuccess] = useState(false);
  const [providerUpgradeSuccess, setProviderUpgradeSuccess] = useState(false);
  const [isNodeUpgrading, setIsNodeUpgrading] = useState(false);
  const [isProviderUpgrading, setIsProviderUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [providerUpgradeMessage, setProviderUpgradeMessage] = useState("");
  const [upgradeStatus, setUpgradeStatus] = useState<{
    node: {
      needsUpgrade: boolean;
      appVersion: { current: string; desired: string; needsUpgrade: boolean };
      chartVersion: { current: string; desired: string; needsUpgrade: boolean };
    };
    provider: {
      needsUpgrade: boolean;
      appVersion: { current: string; desired: string; needsUpgrade: boolean };
      chartVersion: { current: string; desired: string; needsUpgrade: boolean };
    };
  } | null>(null);
  const [isUpgradeStatusLoading, setIsUpgradeStatusLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallError, setUninstallError] = useState<string | null>(null);

  const { providerDetails } = useProvider();
  const { activeControlMachine } = useControlMachine();
  const [url, setUrl] = useState(() => stripProviderPrefixAndPort(providerDetails?.hostUri ?? "") || "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useSelectedChain();

  const { data: kubeNodesResponse, isLoading: isNodesLoading } = useKubeNodesQuery();
  const nodes = kubeNodesResponse?.nodes || [];
  const hasMultipleNodes = nodes.length > 1;

  const isDisabled = !activeControlMachine;

  useEffect(() => {
    if (providerDetails?.email) {
      setEmail(providerDetails.email);
    }
  }, [providerDetails]);

  const fetchUpgradeStatus = useCallback(async () => {
    if (!activeControlMachine) return;

    try {
      setIsUpgradeStatusLoading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: {
        node: {
          needs_upgrade: boolean;
          app_version: { current: string; desired: string; needs_upgrade: boolean };
          chart_version: { current: string; desired: string; needs_upgrade: boolean };
        };
        provider: {
          needs_upgrade: boolean;
          app_version: { current: string; desired: string; needs_upgrade: boolean };
          chart_version: { current: string; desired: string; needs_upgrade: boolean };
        };
      } = await restClient.post("/upgrade-status", request);

      if (response) {
        setUpgradeStatus({
          node: {
            needsUpgrade: response.node.needs_upgrade,
            appVersion: {
              current: response.node.app_version.current,
              desired: response.node.app_version.desired,
              needsUpgrade: response.node.app_version.needs_upgrade
            },
            chartVersion: {
              current: response.node.chart_version.current,
              desired: response.node.chart_version.desired,
              needsUpgrade: response.node.chart_version.needs_upgrade
            }
          },
          provider: {
            needsUpgrade: response.provider.needs_upgrade,
            appVersion: {
              current: response.provider.app_version.current,
              desired: response.provider.app_version.desired,
              needsUpgrade: response.provider.app_version.needs_upgrade
            },
            chartVersion: {
              current: response.provider.chart_version.current,
              desired: response.provider.chart_version.desired,
              needsUpgrade: response.provider.chart_version.needs_upgrade
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch upgrade status:", error);
    } finally {
      setIsUpgradeStatusLoading(false);
    }
  }, [activeControlMachine]);

  useEffect(() => {
    fetchUpgradeStatus();
  }, [activeControlMachine, fetchUpgradeStatus]);

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

  const upgradeAkashNode = async () => {
    if (!activeControlMachine || !upgradeStatus?.node.needsUpgrade) return;

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

  const upgradeProvider = async () => {
    if (!activeControlMachine || !upgradeStatus?.provider.needsUpgrade) return;

    try {
      setIsProviderUpgrading(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: { message: string; action_id: string } = await restClient.post("/provider/upgrade", request);

      if (response) {
        setProviderUpgradeMessage(response.message);
        setProviderUpgradeSuccess(true);

        if (response.action_id) {
          // Navigate to activity logs page with the action ID
          router.push(`/activity-logs/${response.action_id}`);
        } else {
          // If no action_id, just show success message temporarily
          setTimeout(() => setProviderUpgradeSuccess(false), 20000);
        }

        // Refresh upgrade status after a delay
        setTimeout(() => fetchUpgradeStatus(), 5000);
      }
    } catch (error) {
      console.error("Failed to upgrade provider:", error);
    } finally {
      setIsProviderUpgrading(false);
    }
  };

  const getNodeUpgradeReason = () => {
    if (!upgradeStatus?.node.needsUpgrade) return null;

    const reasons: string[] = [];

    if (upgradeStatus.node.appVersion.needsUpgrade) {
      reasons.push(`application version (${upgradeStatus.node.appVersion.current} → ${upgradeStatus.node.appVersion.desired})`);
    }

    if (upgradeStatus.node.chartVersion.needsUpgrade) {
      reasons.push(`chart version (${upgradeStatus.node.chartVersion.current} → ${upgradeStatus.node.chartVersion.desired})`);
    }

    return reasons.length > 0 ? `Update available for ${reasons.join(" and ")}` : null;
  };

  const getProviderUpgradeReason = () => {
    if (!upgradeStatus?.provider.needsUpgrade) return null;

    const reasons: string[] = [];

    if (upgradeStatus.provider.appVersion.needsUpgrade) {
      reasons.push(`application version (${upgradeStatus.provider.appVersion.current} → ${upgradeStatus.provider.appVersion.desired})`);
    }

    if (upgradeStatus.provider.chartVersion.needsUpgrade) {
      reasons.push(`chart version (${upgradeStatus.provider.chartVersion.current} → ${upgradeStatus.provider.chartVersion.desired})`);
    }

    return reasons.length > 0 ? `Update available for ${reasons.join(" and ")}` : null;
  };

  const handleEmailUpdate = async () => {
    try {
      setIsEmailLoading(true);
      emailSchema.parse(email);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine),
        email: email
      };
      const response = await restClient.post("/update-provider-email", request);
      if (response) {
        setEmailSuccess(true);
        setTimeout(() => setEmailSuccess(false), 20000);
        // Refresh provider details to get updated email
        queryClient.invalidateQueries({ queryKey: ["providerDetails", address] });
        setIsEditingEmail(false);
      }
      setEmailError("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
      } else {
        console.error("Error updating email:", error);
        setEmailError("Failed to update email. Please try again.");
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleUninstallProvider = async () => {
    if (!activeControlMachine) return;
    try {
      setUninstallError(null);
      setIsUninstalling(true);
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine)
      };
      const response: { message: string; action_id: string } = await restClient.post("/uninstall-provider", request);

      if (response.action_id) {
        router.push(`/activity-logs/${response.action_id}`);
      }
      setIsUninstallModalOpen(false);
    } catch (error) {
      console.error("Failed to uninstall provider:", error);
      setUninstallError("Failed to uninstall provider. Please try again.");
    } finally {
      setIsUninstalling(false);
    }
  };

  return (
    <Layout>
      <ControlMachineError activity="settings" className="mb-4" />
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
                    <span className="text-base font-semibold">{upgradeStatus.node.appVersion.current}</span>
                    {upgradeStatus.node.appVersion.needsUpgrade && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <ArrowUp className="mr-1 h-3 w-3" />
                        {upgradeStatus.node.appVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 rounded-md border p-3">
                  <h3 className="text-muted-foreground text-sm font-medium">Chart Version</h3>
                  <div className="mt-1 flex items-center">
                    <span className="text-base font-semibold">{upgradeStatus.node.chartVersion.current}</span>
                    {upgradeStatus.node.chartVersion.needsUpgrade && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <ArrowUp className="mr-1 h-3 w-3" />
                        {upgradeStatus.node.chartVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {upgradeStatus.node.needsUpgrade ? (
                <>
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start">
                      <WarningTriangle className="mr-2 mt-0.5 h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-amber-800">{getNodeUpgradeReason()}</p>
                        {/* <p className="text-sm text-amber-700 mt-1">Upgarding may cause temporary service interruption for bid engine.</p> */}
                      </div>
                    </div>
                  </div>
                  <Button onClick={upgradeAkashNode} className="mt-2" disabled={isDisabled || isNodeUpgrading}>
                    {isNodeUpgrading ? (
                      <>
                        <Refresh className="mr-2 h-4 w-4 animate-spin" />
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
                    <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-green-500" />
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

          {isUpgradeStatusLoading ? (
            <div className="mt-4 flex items-center">
              <div className="border-primary mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
              <span>Checking for upgrades...</span>
            </div>
          ) : upgradeStatus ? (
            <div className="mt-4">
              <div className="mb-4 flex gap-4">
                <div className="flex-1 rounded-md border p-3">
                  <h3 className="text-muted-foreground text-sm font-medium">Provider Version</h3>
                  <div className="mt-1 flex items-center">
                    <span className="text-base font-semibold">{upgradeStatus.provider.appVersion.current}</span>
                    {upgradeStatus.provider.appVersion.needsUpgrade && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <ArrowUp className="mr-1 h-3 w-3" />
                        {upgradeStatus.provider.appVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 rounded-md border p-3">
                  <h3 className="text-muted-foreground text-sm font-medium">Chart Version</h3>
                  <div className="mt-1 flex items-center">
                    <span className="text-base font-semibold">{upgradeStatus.provider.chartVersion.current}</span>
                    {upgradeStatus.provider.chartVersion.needsUpgrade && (
                      <span className="ml-2 flex items-center text-xs text-amber-500">
                        <ArrowUp className="mr-1 h-3 w-3" />
                        {upgradeStatus.provider.chartVersion.desired}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {upgradeStatus.provider.needsUpgrade ? (
                <>
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start">
                      <WarningTriangle className="mr-2 mt-0.5 h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-amber-800">{getProviderUpgradeReason()}</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={upgradeProvider} className="mt-2" disabled={isDisabled || isProviderUpgrading}>
                    {isProviderUpgrading ? (
                      <>
                        <Refresh className="mr-2 h-4 w-4 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      "Upgrade Provider"
                    )}
                  </Button>
                </>
              ) : (
                <div className="mb-4 rounded-md border p-3">
                  <div className="flex items-start">
                    <CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-800">Your Provider is up to date</p>
                      <p className="mt-1 text-sm text-green-700">The upgrade button will be enabled when a new version is available.</p>
                    </div>
                  </div>
                </div>
              )}

              {providerUpgradeSuccess && (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-green-800">{providerUpgradeMessage || "Provider upgrade started successfully"}</p>
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

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Email Settings</h2>
          <p className="text-muted-foreground mt-2">Update your provider email address for future notifications.</p>
          <div className="mt-4 flex gap-4">
            <Input
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setIsEditingEmail(true);
              }}
              onFocus={() => setIsEditingEmail(true)}
              placeholder={providerDetails?.email || "Enter email address"}
              error={emailError ? true : undefined}
              className={cn("min-w-[400px]")}
              disabled={isDisabled}
              type="email"
            />
            <Button onClick={handleEmailUpdate} disabled={isDisabled || isEmailLoading}>
              {isEmailLoading ? "Updating..." : "Update Email"}
            </Button>
          </div>
          {emailError && <p className="mt-2 text-sm text-red-500">{emailError}</p>}
          {emailSuccess && (
            <Alert variant="success" className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Email updated successfully</AlertDescription>
            </Alert>
          )}
          {isEditingEmail && providerDetails?.email && <p className="text-muted-foreground mt-2 text-sm">Current email: {providerDetails.email}</p>}
        </div>

        <div className="border-destructive/20 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10 rounded-lg border p-6">
          <h2 className="text-xl font-semibold text-red-500 dark:text-red-400">Danger Zone</h2>
          <p className="text-muted-foreground mt-2">
            Actions in this section can lead to permanent data loss and service disruption. Please proceed with caution.
          </p>
          <div className="mt-4">
            <Button variant="destructive" onClick={() => setIsUninstallModalOpen(true)} disabled={isDisabled || isUninstalling}>
              {isUninstalling ? "Uninstalling..." : "Uninstall Provider"}
            </Button>
            <p className="text-muted-foreground mt-2 text-sm">
              This will remove all provider services, additional nodes, and K3S services. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      <Popup
        open={isUninstallModalOpen}
        onClose={() => setIsUninstallModalOpen(false)}
        variant="custom"
        title="Uninstall Provider"
        maxWidth="sm"
        actions={[
          {
            label: "Cancel",
            variant: "outline",
            side: "left",
            onClick: () => setIsUninstallModalOpen(false),
            disabled: isUninstalling
          },
          {
            label: isUninstalling ? (
              <>
                <Refresh className="mr-2 h-4 w-4 animate-spin" />
                Uninstalling...
              </>
            ) : (
              "Uninstall Provider"
            ),
            variant: "destructive",
            side: "right",
            onClick: handleUninstallProvider,
            disabled: isUninstalling || hasMultipleNodes || isNodesLoading
          }
        ]}
      >
        <div className="space-y-4">
          {hasMultipleNodes ? (
            <div className="rounded-md border border-yellow-500 bg-yellow-50 p-4 dark:border-yellow-400 dark:bg-yellow-900/30">
              <div className="mb-2 font-semibold text-yellow-700 dark:text-yellow-300">Multiple Nodes Detected</div>
              <div className="text-yellow-700 dark:text-yellow-200">
                Please remove all additional nodes from <span className="font-semibold">Node Management</span> before uninstalling the provider.
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-red-500 p-4 dark:border-red-400">
                <div className="flex items-center gap-2">
                  <WarningTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="font-semibold text-red-500 dark:text-red-400">Warning</span>
                </div>
                <div className="mt-1 text-red-500 dark:text-red-400">This action is irreversible and will result in:</div>
              </div>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>Deletion of all provider services</li>
                <li>Removal of K3S services</li>
                <li>Loss of all provider configurations and settings</li>
              </ul>
              <p className="text-foreground font-medium">Are you absolutely sure you want to proceed?</p>
            </>
          )}
          {uninstallError && (
            <div className="rounded-md border border-red-500 bg-red-50 p-4 dark:border-red-400 dark:bg-red-900/30">
              <p className="text-red-700 dark:text-red-200">{uninstallError}</p>
            </div>
          )}
        </div>
      </Popup>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: SettingsPage, authLevel: "provider" });
