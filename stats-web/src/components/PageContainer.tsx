import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  className?: string;
};

export const PageContainer: React.FunctionComponent<Props> = ({ children, className = "" }) => {
  return (
    <div
      className={cn("pt-4 container pb-8 sm:pt-8", className)}
      // sx={{ paddingTop: { xs: "1rem", sm: "2rem" }, paddingBottom: "2rem", ...sx }}
    >
      {children}
    </div>
  );
};

export default PageContainer;
