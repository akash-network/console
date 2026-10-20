import type { FC } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";

export interface ActivityToastProps {
  title: string;
  subTitle: string;
  iconVariant: "success" | "info" | "warning" | "error";
  actionLabel: string;
  onAction: () => void;
}

export const ActivityToast: FC<ActivityToastProps> = ({ title, subTitle, iconVariant, actionLabel, onAction }) => (
  <Snackbar
    title={title}
    iconVariant={iconVariant}
    subTitle={subTitle}
    action={
      <Button size="xs" className="text-xs" onClick={onAction}>
        {actionLabel}
      </Button>
    }
  />
);
