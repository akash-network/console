import { Snackbar } from "@akashnetwork/ui/components";
import { isAxiosError } from "axios";

export type ManifestErrorSnackbarProps = {
  err: unknown;
  messages?: Record<string, string>;
};

export const ManifestErrorSnackbar = ({ err, messages }: ManifestErrorSnackbarProps) => {
  return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${generateErrorText(err, messages)}`} iconVariant="error" />;
};

function generateErrorText(err: unknown, customMessages?: Record<string, string>) {
  if (isAxiosError(err) && err.response?.status === 401) {
    return `You don't have local certificate. Please create a new one.`;
  }

  if (isAxiosError(err) && err.response?.status === 400) {
    if (!err.response.data?.error?.issues) return DEFAULT_ERROR_MESSAGE;

    const errors = new Set<string>();
    err.response.data.error.issues.forEach((issue: Record<string, any>) => {
      const key = `${issue.path.join(".")}.${issue.params?.reason}`;
      const error = customMessages?.[key] ?? ERRORS_MAPPING[key];
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
const ERRORS_MAPPING: Record<string, string> = {
  "certPem.expired": "Your certificate has expired. Please create a new one.",
  "certPem.missingCertPair": "Please provide both public and private key of your certificate.",
  "certPem.invalid": "Provider rejected your certificate. Please try to create a new one. If the problem persists, please contact support."
};
