"use client";
import type { ChangeEvent, FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@akashnetwork/ui/components";
import { LockKeyhole } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";

export const DEPENDENCIES = {
  useServices,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets
};

/**
 * Holds a secret typed into an action card outside React state and outside the conversation, and hands the card only the
 * JWE sealed for the api, the same seal the deployment editor sends; the value is wiped once sealed and on unmount.
 */
export function useSecureSecretInput(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = d.useServices();
  const { mutateAsync: getSealContext } = api.v1.getSDLSecretsContext.useMutation();
  const valueRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(false);

  const clear = useCallback(() => {
    valueRef.current = "";
    if (inputRef.current) inputRef.current.value = "";
    setHasValue(false);
  }, []);

  useEffect(function forgetValueOnUnmount() {
    return () => {
      valueRef.current = "";
    };
  }, []);

  const remember = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    valueRef.current = event.target.value;
    setHasValue(event.target.value.length > 0);
  }, []);

  const sealAndClear = useCallback(
    async (name: string): Promise<string> => {
      const value = valueRef.current;
      try {
        const { data: context } = await getSealContext();
        return await d.sealSdlSecrets({ context, secrets: { [name]: value } });
      } finally {
        clear();
      }
    },
    [getSealContext, clear, d]
  );

  return { inputRef, remember, hasValue, sealAndClear, clear };
}

export type SecureSecretInputState = ReturnType<typeof useSecureSecretInput>;

type Props = {
  label: string;
  secret: SecureSecretInputState;
  disabled?: boolean;
};

export const SecureSecretInput: FC<Props> = ({ label, secret, disabled }) => (
  <div className="flex flex-col gap-1.5">
    <Input
      ref={secret.inputRef}
      type="password"
      label={label}
      autoComplete="new-password"
      spellCheck={false}
      disabled={disabled}
      onChange={secret.remember}
      endIconClassName="pr-3"
      endIcon={<LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
    />
    <p className="text-xs text-muted-foreground">
      Sealed in your browser and sent straight to your deployment. The assistant never sees it, and it isn&apos;t saved in this conversation.
    </p>
  </div>
);
