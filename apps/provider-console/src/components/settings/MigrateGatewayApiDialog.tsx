"use client";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { CertManagerForm } from "@src/components/cert-manager/CertManagerForm";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useMigrateProviderToGatewayApi } from "@src/queries/useProviderQuery";
import type { CertManagerPayload } from "@src/types/certManager";
import { parseApiError } from "@src/utils/apiErrors";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

interface MigrateGatewayApiDialogProps {
  open: boolean;
  onClose: () => void;
  defaultDomain?: string;
}

const DOMAIN_REGEX = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

export const MigrateGatewayApiDialog: React.FC<MigrateGatewayApiDialogProps> = ({ open, onClose, defaultDomain }) => {
  const [domain, setDomain] = useState(defaultDomain ?? "");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const router = useRouter();
  const { activeControlMachine } = useControlMachine();
  const migration = useMigrateProviderToGatewayApi();

  useEffect(() => {
    if (open) {
      setDomain(defaultDomain ?? "");
      setDomainError(null);
      setRootError(undefined);
      setFieldErrors({});
    }
  }, [open, defaultDomain]);

  const validateDomain = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Provider domain is required";
    if (!DOMAIN_REGEX.test(trimmed)) return "Invalid domain name format";
    return null;
  };

  const handleSubmit = async (certManager: CertManagerPayload) => {
    const validationError = validateDomain(domain);
    setDomainError(validationError);
    if (validationError) return;
    if (!activeControlMachine) {
      setRootError("Control machine is not connected. Reconnect and try again.");
      return;
    }

    setRootError(undefined);
    setFieldErrors({});

    try {
      const response = await migration.mutateAsync({
        domain: domain.trim(),
        control_machine: sanitizeMachineAccess(activeControlMachine),
        cert_manager: certManager
      });
      router.push(`/activity-logs/${response.action_id}`);
    } catch (error) {
      const parsed = parseApiError(error);
      setRootError(parsed.rootError ?? parsed.message);
      const certManagerFieldErrors = Object.fromEntries(Object.entries(parsed.fieldErrors).filter(([key]) => key.startsWith("cert_manager")));
      setFieldErrors(certManagerFieldErrors);
      const domainFromApi = parsed.fieldErrors.domain;
      if (domainFromApi) setDomainError(domainFromApi);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => (value ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Migrate to Gateway API (v0.12.0)</DialogTitle>
          <DialogDescription>
            v0.12.0 introduces Gateway API and cert-manager. Migration runs 14 sequential steps in place. Allow up to ~10 minutes for the wildcard certificate
            to be issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="migrate-domain">Provider domain</Label>
            <Input
              id="migrate-domain"
              placeholder="provider.example.com"
              value={domain}
              onChange={event => {
                setDomain(event.target.value);
                if (domainError) setDomainError(null);
              }}
            />
            {domainError && <p className="text-destructive text-sm">{domainError}</p>}
          </div>

          {rootError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="whitespace-pre-line">{rootError}</AlertDescription>
            </Alert>
          )}

          <CertManagerForm
            onSubmit={handleSubmit}
            acmeEmailMode="required"
            isSubmitting={migration.isPending}
            submitLabel="Start migration"
            onCancel={onClose}
            fieldErrors={fieldErrors}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MigrateGatewayApiDialog;
