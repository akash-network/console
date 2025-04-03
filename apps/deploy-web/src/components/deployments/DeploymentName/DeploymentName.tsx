import { useMemo } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { OpenInWindow } from "iconoir-react";
import Link from "next/link";

import { LabelValueOld } from "@src/components/shared/LabelValueOld";
import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import { getShortText } from "@src/utils/stringUtils";

export const COMPONENTS = {
  CustomTooltip,
  LabelValue: LabelValueOld,
  Link,
  OpenInWindow
};

export type Props = {
  deployment: {
    dseq: string;
    name?: string;
  };
  deploymentServices?: Record<string, Pick<LeaseServiceStatus, "uris">>;
  providerHostUri?: string;
  components?: typeof COMPONENTS;
};

export const DeploymentName: React.FunctionComponent<Props> = ({ deployment, deploymentServices, providerHostUri, components: c = COMPONENTS }) => {
  const deploymentName = useMemo(() => {
    let name = deployment.name?.trim() || "";
    const services = deploymentServices ? Object.values(deploymentServices) : [];
    const firstServiceWithUris = name ? null : services.find(service => service && service.uris && service.uris.length > 0);
    if (firstServiceWithUris) {
      const providerHost = providerHostUri ? new URL(providerHostUri).hostname.replace(/^provider\./, "") : "";
      name = firstServiceWithUris.uris.find(uri => providerHost && uri && !uri.endsWith(providerHost)) || firstServiceWithUris.uris[0];
    }
    name = name || "Unknown";
    return {
      short: name.length > 20 ? getShortText(name, 15) : name,
      full: name,
      services: Object.entries(deploymentServices || {})
    };
  }, [deployment.name, deploymentServices, providerHostUri]);
  return (
    <c.CustomTooltip
      disabled={!deploymentName.services.length && !deployment.name}
      title={
        <div className="space-y-1 text-left">
          {deployment.name && (
            <>
              <c.LabelValue label="Name:" />
              <div>{deployment.name.trim()}</div>
            </>
          )}
          {deploymentName.services.length > 0 && <c.LabelValue label="Services:" />}
          {deploymentName.services.map(([, service]) =>
            (service.uris || []).map(uri => (
              <c.Link key={uri} href={`http://${uri}`} target="_blank" className="inline-flex items-center space-x-2 space-y-1 truncate text-sm">
                <span>{uri}</span>
                <c.OpenInWindow className="text-xs" />
              </c.Link>
            ))
          )}
        </div>
      }
    >
      <div className="truncate text-sm">{deploymentName.short && <strong>{deploymentName.short}</strong>}</div>
    </c.CustomTooltip>
  );
};
