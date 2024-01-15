import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  className?: string;
};

export const PageContainer: React.FunctionComponent<Props> = ({ children, className = "" }) => {
  return <div className={cn("container pb-8 pt-4 sm:pt-8", className)}>{children}</div>;
};

export default PageContainer;
