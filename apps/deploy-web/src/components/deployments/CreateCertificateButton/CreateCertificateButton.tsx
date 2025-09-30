import type { FC } from "react";
import { useCallback, useMemo } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Alert, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useCertificate } from "@src/context/CertificateProvider";
import { useJwt } from "@src/context/JwtProvider/JwtProviderContext";
import { useSettings } from "@src/context/SettingsProvider";

export const DEPENDENCIES = {
  Alert,
  Button,
  Spinner,
  useCertificate,
  useJwt,
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
  const { isCreatingToken, createToken, isLocalTokenExpired, localToken } = d.useJwt();

  const _createCertificate = useCallback(async () => {
    await createCertificate();
    afterCreate?.();
  }, [createCertificate, afterCreate]);
  const _createToken = useCallback(async () => {
    await createToken();
    afterCreate?.();
  }, [createToken, afterCreate]);
  const isInCertMode = false;
  const warningText = useMemo(() => {
    if (isInCertMode) {
      if (isLocalCertExpired) return "Your certificate has expired. Please create a new one.";
      if (!localCert) return "You need to create a certificate to view deployment details.";
    }

    if (isLocalTokenExpired) return "Your token has expired. Please create a new one.";
    if (!localToken) return "You need to create a token to view deployment details.";

    return undefined;
  }, [isLocalCertExpired, isLocalTokenExpired, localCert, localToken]);
  const buttonText = useMemo(() => {
    if (isInCertMode) {
      return isLocalCertExpired ? "Regenerate Certificate" : "Create Certificate";
    }

    return isLocalTokenExpired ? "Regenerate Token" : "Create Token";
  }, [isLocalCertExpired, isLocalTokenExpired]);

  return (
    <div className={containerClassName}>
      <d.Alert variant="warning" className={cn({ "py-2 text-sm": buttonProps?.size === "sm" }, "truncate")}>
        {warningText}
      </d.Alert>
      {isInCertMode ? (
        <d.Button
          className={warningText ? "mt-4" : ""}
          {...buttonProps}
          disabled={buttonProps?.disabled || settings.isBlockchainDown || isCreatingCert}
          onClick={_createCertificate}
        >
          {isCreatingCert ? <d.Spinner size="small" /> : buttonText}
        </d.Button>
      ) : (
        <d.Button
          className={cn("ml-2", warningText ? "mt-4" : "")}
          {...buttonProps}
          disabled={buttonProps?.disabled || settings.isBlockchainDown || isCreatingToken}
          onClick={_createToken}
        >
          {isCreatingToken ? <d.Spinner size="small" /> : buttonText}
        </d.Button>
      )}
    </div>
  );
};
