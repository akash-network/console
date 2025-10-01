import type { FC } from "react";
import { useCallback, useMemo } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Alert, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useCertificate } from "@src/context/CertificateProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useJwt } from "@src/hooks/useJwt";

export const DEPENDENCIES = {
  Alert,
  Button,
  Spinner,
  useCertificate,
  useJwt,
  useSettings,
  useFlag
};

export interface Props extends Omit<ButtonProps, "onClick"> {
  afterCreate?: () => void;
  containerClassName?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const CreateCertificateButton: FC<Props> = ({ afterCreate, containerClassName, dependencies: d = DEPENDENCIES, ...buttonProps }) => {
  const isJwtEnabled = d.useFlag("jwt_instead_of_cert");
  const { settings } = d.useSettings();
  const { isCreatingCert, createCertificate, isLocalCertExpired, localCert } = d.useCertificate();
  const { isCreatingToken, createToken, isLocalTokenExpired, localToken } = d.useJwt();

  const _createCertificate = useCallback(async () => {
    await createCertificate();
    afterCreate?.();
  }, [createCertificate, afterCreate]);
  const _createToken = useCallback(async () => {
    await createToken();
    afterCreate?.();
  }, [createToken, afterCreate]);
  const warningText = useMemo(() => {
    if (isJwtEnabled) {
      if (isLocalTokenExpired) return "Your token has expired. Please create a new one.";
      if (!localToken) return "You need to create a token to view deployment details.";
    }

    if (isLocalCertExpired) return "Your certificate has expired. Please create a new one.";
    if (!localCert) return "You need to create a certificate to view deployment details.";

    return undefined;
  }, [isJwtEnabled, isLocalCertExpired, isLocalTokenExpired, localCert, localToken]);
  const buttonText = useMemo(() => {
    if (isJwtEnabled) {
      return isLocalTokenExpired ? "Regenerate Token" : "Create Token";
    }

    return isLocalCertExpired ? "Regenerate Certificate" : "Create Certificate";
  }, [isJwtEnabled, isLocalCertExpired, isLocalTokenExpired]);

  return (
    <div className={containerClassName}>
      <d.Alert variant="warning" className={cn({ "py-2 text-sm": buttonProps?.size === "sm" }, "truncate")}>
        {warningText}
      </d.Alert>
      {isJwtEnabled ? (
        <d.Button
          className={cn("ml-2", warningText ? "mt-4" : "")}
          {...buttonProps}
          disabled={buttonProps?.disabled || settings.isBlockchainDown || isCreatingToken}
          onClick={_createToken}
        >
          {isCreatingToken ? <d.Spinner size="small" /> : buttonText}
        </d.Button>
      ) : (
        <d.Button
          className={warningText ? "mt-4" : ""}
          {...buttonProps}
          disabled={buttonProps?.disabled || settings.isBlockchainDown || isCreatingCert}
          onClick={_createCertificate}
        >
          {isCreatingCert ? <d.Spinner size="small" /> : buttonText}
        </d.Button>
      )}
    </div>
  );
};
