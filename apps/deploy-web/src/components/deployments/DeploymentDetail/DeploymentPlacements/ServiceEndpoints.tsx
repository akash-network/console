import type { FC, ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle, OpenInWindow } from "iconoir-react";
import Link from "next/link";

import { CopyTextToClipboardButton } from "@src/components/shared/CopyTextToClipboardButton";

export interface ForwardedPort {
  host: string;
  externalPort: number;
  port: number;
  available: number;
}

export interface ServiceIp {
  IP: string;
  ExternalPort: number;
  Port: number;
  Protocol: string;
}

export interface EndpointLink {
  text: string;
  href?: string;
  copyValue?: string;
  tooltip?: ReactNode;
  disabled?: boolean;
}

/** A comma-delimited, right-aligned list of endpoints, each keeping its open-in-new-tab and copy actions. */
export const EndpointLinks: FC<{ items: EndpointLink[] }> = ({ items }) => (
  <span className="inline-flex flex-wrap items-center justify-start gap-x-1 gap-y-1">
    {items.map((item, index) => (
      <span key={`${item.text}-${index}`} className="inline-flex items-center gap-1">
        {item.href ? (
          <Link
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className={cn("inline-flex items-center gap-1 text-muted-foreground hover:text-foreground", { "pointer-events-none": item.disabled })}
          >
            <span>{item.text}</span>
            <OpenInWindow className="text-xs" />
          </Link>
        ) : (
          <span className="text-muted-foreground">{item.text}</span>
        )}
        {item.tooltip && (
          <CustomTooltip title={item.tooltip}>
            <InfoCircle className="text-xs text-muted-foreground" />
          </CustomTooltip>
        )}
        {item.copyValue && <CopyTextToClipboardButton value={item.copyValue} />}
        {index < items.length - 1 && <span className="text-muted-foreground">,</span>}
      </span>
    ))}
  </span>
);

export function toUriLinks(uris: string[] = []): EndpointLink[] {
  return uris.map(uri => ({ text: uri, href: `http://${uri}`, copyValue: uri }));
}

export function toForwardedPortLinks(ports: ForwardedPort[] = []): EndpointLink[] {
  return ports.map(port => ({
    text: `${port.port}:${port.externalPort}`,
    href: port.host ? `http://${port.host}:${port.externalPort}` : undefined,
    disabled: port.available < 1
  }));
}

export function toIpLinks(ips: ServiceIp[] = []): EndpointLink[] {
  return ips.map(ip => ({
    text: `${ip.IP}:${ip.ExternalPort}`,
    href: `http://${ip.IP}:${ip.ExternalPort}`,
    copyValue: `${ip.IP}:${ip.ExternalPort}`,
    tooltip: (
      <>
        <div>IP:&nbsp;{ip.IP}</div>
        <div>External Port:&nbsp;{ip.ExternalPort}</div>
        <div>Port:&nbsp;{ip.Port}</div>
        <div>Protocol:&nbsp;{ip.Protocol}</div>
      </>
    )
  }));
}
