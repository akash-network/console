import type { FC } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";

export interface ActivityToastProps {
  title: string;
  subTitle: string;
  iconVariant: "success" | "warning" | "error";
  actionLabel: string;
  onAction: () => void;
}

export const ActivityToast: FC<ActivityToastProps> = ({ title, subTitle, iconVariant, actionLabel, onAction }) => (
  <Snackbar
    title={title}
    iconVariant={iconVariant}
    subTitle={
      <>
        <div>{subTitle}</div>
        <Button className="mt-2 h-7 px-3 text-xs" onClick={onAction}>
          {actionLabel}
        </Button>
      </>
    }
  />
);
