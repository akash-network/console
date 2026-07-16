"use client";
import React from "react";
import { Separator } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { CertManagerForm } from "@src/components/cert-manager/CertManagerForm";
import providerProcessStore from "@src/store/providerProcessStore";
import type { CertManagerPayload } from "@src/types/certManager";
import { EMPTY_CERT_MANAGER_SECRETS, EMPTY_CERT_MANAGER_STATE } from "@src/types/certManager";
import { ResetProviderForm } from "./ResetProviderProcess";

interface CertManagerStepProps {
  onComplete: () => void;
}

export const CertManagerStep: React.FC<CertManagerStepProps> = ({ onComplete }) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [, setCertManagerSecrets] = useAtom(providerProcessStore.certManagerSecretsAtom);
  const existing = providerProcess?.certManager ?? EMPTY_CERT_MANAGER_STATE;
  const providerEmail = providerProcess?.config?.email ?? "";
  const providerDomain = providerProcess?.config?.domain ?? "";

  const handleSubmit = (payload: CertManagerPayload) => {
    setCertManagerSecrets({
      cloudflare: payload.dns_provider === "cloudflare" ? payload.cloudflare : EMPTY_CERT_MANAGER_SECRETS.cloudflare,
      clouddns: payload.dns_provider === "clouddns" ? { service_account_json: payload.clouddns.service_account_json } : EMPTY_CERT_MANAGER_SECRETS.clouddns
    });
    setProviderProcess(prev => ({
      ...prev,
      certManager: {
        acme_email: payload.acme_email ?? "",
        dns_provider: payload.dns_provider,
        clouddns: payload.dns_provider === "clouddns" ? { project: payload.clouddns.project } : EMPTY_CERT_MANAGER_STATE.clouddns
      },
      process: {
        ...prev.process,
        certManager: true
      }
    }));
    onComplete();
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h3 className="text-xl">TLS / Cert Manager</h3>
          <p className="text-muted-foreground text-sm">
            Provider v0.12.0 uses cert-manager to issue Let&apos;s Encrypt certificates via DNS-01 challenges. Configure the DNS provider that hosts{" "}
            <code className="text-xs">{providerDomain || "your domain"}</code>.
          </p>
        </div>
        <Separator />
        <CertManagerForm
          onSubmit={handleSubmit}
          acmeEmailMode="optional"
          acmeEmailHelpText={providerEmail ? `Defaults to ${providerEmail} if left blank.` : "Defaults to your provider email if left blank."}
          defaultValues={{
            acme_email: existing.acme_email || providerEmail || "",
            dns_provider: existing.dns_provider === "" ? undefined : existing.dns_provider
          }}
          submitLabel="Next"
        />
        <Separator />
        <div className="flex w-full justify-start">
          <ResetProviderForm />
        </div>
      </div>
    </div>
  );
};
