import { burningGradientStyle } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  className?: string;
};

export const GradientText: React.FunctionComponent<Props> = ({ children, className = "" }) => {
  return (
    <span className={cn("inline-block", className)} style={{ ...burningGradientStyle }}>
      {children}
    </span>
  );
};
