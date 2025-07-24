import { Snackbar } from "@akashnetwork/ui/components";
import { isAxiosError } from "axios";

export type ManifestErrorSnackbarProps = {
  err: unknown;
};

export const ManifestErrorSnackbar = ({ err }: ManifestErrorSnackbarProps) => {
  return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${generateErrorText(err)}`} iconVariant="error" />;
};

function generateErrorText(err: unknown) {
  if (isAxiosError(err) && err.response?.status === 401) {
    return `You don't have local certificate. Please create a new one.`;
  }

  if (isAxiosError(err) && err.response?.status === 400) {
    if (!err.response.data.issues) return DEFAULT_ERROR_MESSAGE;

    const errors = new Set<string>();
    err.response.data.issues.forEach((issue: Record<string, any>) => {
      const error = ERRORS_MAPPING[issue.path[0]]?.[issue.params?.reason];
      if (error) {
        errors.add(error);
      } else {
        errors.add(DEFAULT_ERROR_MESSAGE);
      }
    });
    return Array.from(errors).join("\n ");
  }

  return err;
}

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try refreshing the page and try again.";
const ERRORS_MAPPING: Record<string, Record<string, string>> = {
  certPem: {
    expired: "Your certificate has expired. Please create a new one.",
    missingCertPair: "Please provide both public and private key of your certificate."
  }
};
