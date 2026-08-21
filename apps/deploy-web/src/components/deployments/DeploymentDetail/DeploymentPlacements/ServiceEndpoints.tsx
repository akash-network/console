import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { OpenInWindow } from "iconoir-react";
import Link from "next/link";

import type { ForwardedPort, ServiceIp } from "@src/queries/useLeaseQuery";

export interface EndpointLink {
  text: string;
  href?: string;
}

export interface PortChip {
  port: number;
  as?: number;
  proto?: string;
  href?: string;
  available: boolean;
}

/** URI links: hostname + open-in-new-tab, no copy or comma separators. */
export const ServiceUriLinks: FC<{ items: EndpointLink[] }> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(item =>
        item.href ? (
          <Link key={item.text} href={item.href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:text-foreground">
            <span className="truncate">{item.text}</span>
            <OpenInWindow className="shrink-0 text-xs" />
          </Link>
        ) : (
          <span key={item.text} className="truncate">
            {item.text}
          </span>
        )
      )}
    </span>
  );
};

export const PortChips: FC<{ items: PortChip[] }> = ({ items }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    {items.map((item, index) => {
      const className = "inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-sm";
      const content = (
        <>
          <span className="font-medium">{item.port}</span>
          {item.as !== undefined && <span className="text-muted-foreground"> :{item.as}</span>}
          {item.proto && <span className="text-muted-foreground"> /{item.proto}</span>}
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", item.available ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          <span className="sr-only">{item.available ? "Available" : "Unavailable"}</span>
        </>
      );

      return item.href ? (
        <Link key={`${item.port}-${index}`} href={item.href} target="_blank" rel="noreferrer" className={className}>
          {content}
        </Link>
      ) : (
        <span key={`${item.port}-${index}`} className={className}>
          {content}
        </span>
      );
    })}
  </span>
);

export function toUriLinks(uris?: string[] | null): EndpointLink[] {
  return (Array.isArray(uris) ? uris : []).map(uri => ({ text: uri, href: `http://${uri}` }));
}

/** Live forwarded ports and leased IPs as chips. A closed lease yields no chips. */
export function toPortChips(input: { forwardedPorts?: ForwardedPort[] | null; ips?: ServiceIp[] | null; closed?: boolean }): PortChip[] {
  if (input.closed) return [];

  const forwarded = Array.isArray(input.forwardedPorts) ? input.forwardedPorts : [];
  const ips = Array.isArray(input.ips) ? input.ips : [];

  return [
    ...forwarded.map(port => {
      const available = port.available > 0;
      return {
        port: port.port,
        as: port.externalPort,
        href: available && port.host ? `http://${port.host}:${port.externalPort}` : undefined,
        available
      };
    }),
    ...ips.map(ip => ({
      port: ip.Port,
      as: ip.ExternalPort,
      proto: ip.Protocol ? ip.Protocol.toLowerCase() : undefined,
      href: `http://${ip.IP}:${ip.ExternalPort}`,
      available: true
    }))
  ];
}
