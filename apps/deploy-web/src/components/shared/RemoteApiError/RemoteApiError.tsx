import { isHttpError } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription } from "@akashnetwork/ui/components";

interface Props {
  error: Error | null | undefined;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Alert,
  AlertDescription
};

export function RemoteApiError({ error, className, dependencies: d = DEPENDENCIES }: Props) {
  if (!error) return null;
  return (
    <d.Alert variant="destructive" className={className}>
      <d.AlertDescription>
        {isHttpError(error) && error.response?.data.message
          ? error.response.data.message
          : "An unexpected error occurred. Please try again or contact support if the issue persists."}
      </d.AlertDescription>
    </d.Alert>
  );
}
