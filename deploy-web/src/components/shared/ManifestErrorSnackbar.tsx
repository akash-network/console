import { Snackbar } from "./Snackbar";

export const ManifestErrorSnackbar = ({ err }) => {
  return <Snackbar title="Error" subTitle={`Error while sending manifest to provider. ${err}`} iconVariant="error" />;
};
