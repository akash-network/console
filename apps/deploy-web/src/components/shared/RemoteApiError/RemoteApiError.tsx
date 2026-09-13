import { isHttpError } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription } from "@akashnetwork/ui/components";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";

interface Props {
  error: Error | null | undefined;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Alert,
  AlertDescription
};

const FALLBACK_MESSAGE = "An unexpected error occurred. Please try again or contact support if the issue persists.";

function describeError(error: Error): string {
  if (error instanceof CaptchaChallengeError) {
    return error.message;
  }

  if (isHttpError(error) && error.response?.data.message) {
    return error.response.data.message;
  }

  return FALLBACK_MESSAGE;
}

export function RemoteApiError({ error, className, dependencies: d = DEPENDENCIES }: Props) {
  if (!error) return null;
  return (
    <d.Alert variant="destructive" className={className}>
      <d.AlertDescription>{describeError(error)}</d.AlertDescription>
    </d.Alert>
  );
}
