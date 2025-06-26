import type { FC } from "react";
import { useCallback } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Alert, Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useCertificate } from "@src/context/CertificateProvider";

export const COMPONENTS = {
  Alert,
  Button
};

export interface Props extends Omit<ButtonProps, "onClick"> {
  warningText?: string;
  afterCreate?: () => void;
  containerClassName?: string;
  components?: typeof COMPONENTS;
}

export const CreateCertificateButton: FC<Props> = ({ warningText, afterCreate, containerClassName, components: c = COMPONENTS, ...buttonProps }) => {
  const { isCreatingCert, createCertificate } = useCertificate();

  const _createCertificate = useCallback(async () => {
    await createCertificate();
    afterCreate?.();
  }, [createCertificate, afterCreate]);

  return (
    <div className={containerClassName}>
      {warningText && (
        <c.Alert variant="warning" className={cn({ "py-2 text-sm": buttonProps?.size === "sm" }, "truncate")}>
          {warningText}
        </c.Alert>
      )}
      <c.Button className={warningText ? "mt-4" : ""} {...buttonProps} disabled={buttonProps?.disabled || isCreatingCert} onClick={_createCertificate}>
        {isCreatingCert ? <Spinner size="small" /> : "Create Certificate"}
      </c.Button>
    </div>
  );
};
