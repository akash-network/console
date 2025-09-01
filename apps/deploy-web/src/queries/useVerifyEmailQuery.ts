import type { VerifyEmailResponse } from "@akashnetwork/http-sdk";
import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export function useVerifyEmail(
  options: {
    onSuccess?: (isVerified: boolean) => void;
    onError?: () => void;
  } = {}
) {
  const { auth } = useServices();

  return useMutation<VerifyEmailResponse, Error, string>({
    mutationFn: (email: string) => auth.verifyEmail(email),
    onSuccess: response => {
      options.onSuccess?.(response.data.emailVerified);
    },
    onError: _error => {
      options.onError?.();
    }
  });
}
