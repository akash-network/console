"use client";
import type { ReactNode } from "react";
import { Check, InfoCircle, WarningCircle, WarningTriangle } from "iconoir-react";

import { cn } from "../../utils";
import { Spinner } from "../spinner";

type IconVariant = "info" | "warning" | "error" | "success";
type Props = {
  title: string;
  subTitle?: string | ReactNode;
  iconVariant?: IconVariant;
  showLoading?: boolean;
  children?: ReactNode;
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
        <h5 className="flex-grow text-lg font-semibold leading-4 tracking-tight">{title}</h5>
      </div>

      {subTitle && <p className="break-words text-xs">{subTitle}</p>}
    </div>
  );
};

const getIcon = (variant?: IconVariant) => {
  switch (variant) {
    case "info":
      return <InfoCircle className="text-sm" />;
    case "warning":
      return <WarningTriangle className="text-sm" />;
    case "error":
      return <WarningCircle className="text-sm" />;
    case "success":
      return <Check className="text-sm" />;

    default:
      return null;
  }
};
