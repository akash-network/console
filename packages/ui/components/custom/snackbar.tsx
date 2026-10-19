"use client";
import type { ReactNode } from "react";

import { cn } from "../../utils";
import { Spinner } from "../spinner";

type IconVariant = "info" | "warning" | "error" | "success";
type Props = {
  title: string;
  subTitle?: string | ReactNode;
  iconVariant?: IconVariant;
  showLoading?: boolean;
  /** Sits on the right of the toast, such as a "View" or "Undo" button. */
  action?: ReactNode;
  ["data-testid"]?: string;
};

export const Snackbar: React.FunctionComponent<Props> = ({ title, subTitle, iconVariant, showLoading = false, action, "data-testid": dataTestId }) => {
  const icon = iconVariant && <ToastIcon variant={iconVariant} />;

  return (
    <div data-testid={dataTestId} className="flex items-center gap-3">
      {(icon || showLoading) && (
        <div className="flex shrink-0 items-center gap-2 self-start pt-px">
          {icon}
          {showLoading && <Spinner size="small" className="flex h-[18px] w-[18px] items-center justify-center" />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h5 className="text-sm font-medium leading-5">{title}</h5>
        {subTitle && <div className="mt-0.5 break-words text-[13px] leading-5 text-muted-foreground">{subTitle}</div>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

const GLYPH_PROPS = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function ToastIcon({ variant }: { variant: IconVariant }) {
  return (
    <svg viewBox="0 0 20 20" role="img" aria-label={ICON_LABELS[variant]} className={cn("h-[18px] w-[18px]", ICON_COLORS[variant])}>
      {variant === "warning" ? (
        <path d="M8.27 2.5a2 2 0 0 1 3.46 0l6.93 12a2 2 0 0 1-1.73 3H3.07a2 2 0 0 1-1.73-3z" fill="currentColor" />
      ) : (
        <circle cx="10" cy="10" r="9" fill="currentColor" />
      )}
      <g {...GLYPH_PROPS} className={variant === "info" ? "stroke-background" : "stroke-white"}>
        {GLYPHS[variant]}
      </g>
    </svg>
  );
}

const ICON_LABELS: Record<IconVariant, string> = {
  success: "Success",
  info: "Info",
  warning: "Warning",
  error: "Error"
};

const ICON_COLORS: Record<IconVariant, string> = {
  success: "text-green-500",
  info: "text-foreground",
  warning: "text-amber-500",
  error: "text-red-500"
};

const GLYPHS: Record<IconVariant, ReactNode> = {
  success: <path d="m6.25 10.25 2.5 2.5 5-5.25" strokeWidth={1.75} />,
  info: (
    <>
      <path d="M10 9.25v4.5" />
      <path d="M10 6.25h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M10 7v4" />
      <path d="M10 14h.01" />
    </>
  ),
  error: (
    <>
      <path d="M10 5.75v4.5" />
      <path d="M10 13.75h.01" />
    </>
  )
};
