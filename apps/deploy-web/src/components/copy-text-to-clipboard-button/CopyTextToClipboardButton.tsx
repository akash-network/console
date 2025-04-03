import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import { useCallback } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { Copy } from "iconoir-react";
import { useSnackbar } from "notistack";

interface Props {
  value: string;
  message?: string;
  icon?: ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>;
}

const defaultProps = {
  message: "Copied to clipboard!",
  icon: Copy
};

export const CopyTextToClipboardButton: React.FunctionComponent<Props> = props => {
  const actualProps = { ...defaultProps, ...props };
  const { enqueueSnackbar } = useSnackbar();

  const onClick = useCallback(() => {
    copyTextToClipboard(actualProps.value);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  }, [actualProps.value, enqueueSnackbar]);

  return (
    <Button onClick={onClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
      <actualProps.icon className="text-xs text-muted-foreground" />
    </Button>
  );
};
