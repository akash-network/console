import { Snackbar } from "@akashnetwork/ui/components";

export type ManifestErrorSnackbarProps = {
  err: unknown;
};

export const ManifestErrorSnackbar = ({ err }: ManifestErrorSnackbarProps) => {
  return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${err}`} iconVariant="error" />;
};
