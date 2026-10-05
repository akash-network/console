import type { FC, ReactNode } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import type { ApiProviderDetail } from "@src/types/provider";
import { ProfileCard, ProfileRow } from "./ProfileCard";

type Provider = Pick<
  ApiProviderDetail,
  | "isAudited"
  | "organization"
  | "website"
  | "statusPage"
  | "email"
  | "locationType"
  | "hostingProvider"
  | "hardwareCpu"
  | "hardwareMemory"
  | "hardwareCpuArch"
  | "reportedCpuArchs"
  | "cpuArchAgreement"
  | "akashVersion"
>;

/** Only plain address characters, so a provider-set email can't smuggle mailto parameters such as ?bcc= into the link. */
const EMAIL_ADDRESS = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

type Props = {
  provider: Provider;
  kubeVersion: string | null;
};

export const OperatorCard: FC<Props> = ({ provider, kubeVersion }) => {
  const facility = [provider.locationType, provider.hostingProvider].filter(Boolean).join(" · ");
  const hardware = [provider.hardwareCpu, provider.hardwareMemory].filter(Boolean).join(" · ");
  const versions = [provider.akashVersion && `Akash ${provider.akashVersion}`, kubeVersion && `Kube ${kubeVersion}`].filter(Boolean);

  return (
    <ProfileCard
      title="Operator"
      aside={
        provider.isAudited && (
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Audited
          </span>
        )
      }
    >
      <div className="px-3.5 pb-3 pt-1.5">
        <dl>
          <OptionalRow label="Organization">{provider.organization}</OptionalRow>
          <OptionalRow label="Website">{provider.website && <ExternalLink href={toWebUrl(provider.website)}>{provider.website}</ExternalLink>}</OptionalRow>
          <OptionalRow label="Status page">
            {provider.statusPage && <ExternalLink href={toWebUrl(provider.statusPage)}>{provider.statusPage}</ExternalLink>}
          </OptionalRow>
          <OptionalRow label="Email">
            {provider.email &&
              (EMAIL_ADDRESS.test(provider.email) ? <ExternalLink href={`mailto:${provider.email}`}>{provider.email}</ExternalLink> : provider.email)}
          </OptionalRow>
          <OptionalRow label="Facility">{facility}</OptionalRow>
          <OptionalRow label="Hardware">{hardware}</OptionalRow>
          <ProfileRow label="CPU architecture">{describeCpuArchitecture(provider)}</ProfileRow>
        </dl>
        {provider.cpuArchAgreement === "mismatch" && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-warning">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            The nodes report {provider.reportedCpuArchs.join(", ")}, which differs from the declared {provider.hardwareCpuArch}.
          </p>
        )}
        {versions.length > 0 && (
          <div className="mt-[11px] flex flex-wrap gap-1.5">
            {versions.map(version => (
              <span key={version} className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                {version}
              </span>
            ))}
          </div>
        )}
      </div>
    </ProfileCard>
  );
};

const OptionalRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (children ? <ProfileRow label={label}>{children}</ProfileRow> : null);

const ExternalLink: FC<{ href: string; children: ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="border-b border-dotted border-muted-foreground text-foreground hover:border-foreground">
    {children}
  </a>
);

function toWebUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function describeCpuArchitecture({ reportedCpuArchs, hardwareCpuArch }: Provider): string {
  if (reportedCpuArchs.length > 0) return reportedCpuArchs.join(", ");
  return hardwareCpuArch ? `${hardwareCpuArch} (declared)` : "Unknown";
}
