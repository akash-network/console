import { isHttpError } from "@akashnetwork/http-sdk";
import { Snackbar } from "@akashnetwork/ui/components";

export type ManifestErrorSnackbarProps = {
  err: unknown;
  messages?: Record<string, string>;
};

export const ManifestErrorSnackbar = ({ err, messages }: ManifestErrorSnackbarProps) => {
  return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${generateErrorText(err, messages)}`} iconVariant="error" />;
};

function generateErrorText(err: unknown, customMessages?: Record<string, string>): string {
  if (!isHttpError(err)) {
    return err && err instanceof Error ? err.message : String(err);
  }

  if (err.response?.status === 400 && err.response.data?.error?.issues) {
    const errors = new Set<string>();
    err.response.data.error.issues.forEach((issue: Record<string, any>) => {
      const key = `${issue.path.join(".")}.${issue.params?.reason}`;
      const error = customMessages?.[key];
      if (error) {
        errors.add(error);
      } else {
        errors.add(DEFAULT_ERROR_MESSAGE);
      }
    });
    return Array.from(errors).join("\n ");
  }

  // raw error message from provider. It returns error in text/plain format.
  const message = getProviderResponseError(err.response?.data);
  if (message) return message;

  return err.response?.data ? JSON.stringify(err.response?.data) : DEFAULT_ERROR_MESSAGE;
}

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try refreshing the page and try again.";

function getProviderResponseError(data: unknown): string | undefined {
  if (!data) return;
  if (typeof data === "string") return data;
  if (typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  return;
}
