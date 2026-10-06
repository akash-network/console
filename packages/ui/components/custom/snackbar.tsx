"use client";
import type { ReactNode } from "react";
import { Check, CircleAlert, Info, TriangleAlert } from "lucide-react";

import { cn } from "../../utils";
import { Spinner } from "../spinner";

type IconVariant = "info" | "warning" | "error" | "success";
type Props = {
  title: string;
  subTitle?: string | ReactNode;
  iconVariant?: IconVariant;
  showLoading?: boolean;
  ["data-testid"]?: string;
};

export const Snackbar: React.FunctionComponent<Props> = ({ title, subTitle, iconVariant, showLoading = false, "data-testid": dataTestId }) => {
  const icon = getIcon(iconVariant);

  return (
    <div data-testid={dataTestId}>
      <div className={cn({ ["mb-2"]: !!subTitle }, "flex items-center space-x-2")}>
        {!!icon && <div className="flex items-center">{icon}</div>}

        {showLoading && (
          <div className="flex items-center">
            <Spinner size="small" variant="dark" />
          </div>
        )}
        <h5 className="flex-grow text-lg leading-4">{title}</h5>
      </div>

      {subTitle && <div className="break-words text-xs">{subTitle}</div>}
    </div>
  );
};

const getIcon = (variant?: IconVariant) => {
  switch (variant) {
    case "info":
      return <Info className="h-5 w-5" />;
    case "warning":
      return <TriangleAlert className="h-5 w-5" />;
    case "error":
      return <CircleAlert className="h-5 w-5" />;
    case "success":
      return <Check className="h-5 w-5" />;

    default:
      return null;
  }
};
