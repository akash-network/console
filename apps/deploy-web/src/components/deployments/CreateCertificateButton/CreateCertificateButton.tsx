import type { FC } from "react";
import { useCallback, useMemo } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Alert, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useCertificate } from "@src/context/CertificateProvider";
import { useSettings } from "@src/context/SettingsProvider";

export const DEPENDENCIES = {
  Alert,
  Button,
  Spinner,
  useCertificate,
  useSettings
};

export interface Props extends Omit<ButtonProps, "onClick"> {
  afterCreate?: () => void;
  containerClassName?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const CreateCertificateButton: FC<Props> = ({ afterCreate, containerClassName, dependencies: d = DEPENDENCIES, ...buttonProps }) => {
  const { settings } = d.useSettings();
  const { isCreatingCert, createCertificate, isLocalCertExpired, localCert } = d.useCertificate();

  const _createCertificate = useCallback(async () => {
    await createCertificate();
    afterCreate?.();
  }, [createCertificate, afterCreate]);
  const warningText = useMemo(() => {
    if (isLocalCertExpired) return "Your certificate has expired. Please create a new one.";
    if (!localCert) return "You need to create a certificate to view deployment details.";
    return undefined;
  }, [isLocalCertExpired, isCreatingCert, localCert]);
  const buttonText = useMemo(() => (isLocalCertExpired ? "Regenerate Certificate" : "Create Certificate"), [isLocalCertExpired]);

  return (
    <div className={containerClassName}>
      <d.Alert variant="warning" className={cn({ "py-2 text-sm": buttonProps?.size === "sm" }, "truncate")}>
        {warningText}
      </d.Alert>
      <d.Button
        className={warningText ? "mt-4" : ""}
        {...buttonProps}
        disabled={buttonProps?.disabled || settings.isBlockchainDown || isCreatingCert}
        onClick={_createCertificate}
      >
        {isCreatingCert ? <d.Spinner size="small" /> : buttonText}
      </d.Button>
    </div>
  );
};
