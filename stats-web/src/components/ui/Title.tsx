import { cn } from "@/lib/utils";
import { GradientText } from "./GradientText";
import { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  hasMargin?: boolean;
  subTitle?: boolean;
  className?: string;
};

export const Title: React.FunctionComponent<Props> = ({ children, subTitle, className = "" }) => {
  return subTitle ? (
    <h3 className={cn(className, "text-xl font-semibold sm:text-2xl")}>{children}</h3>
  ) : (
    <h1 className={cn(className, "text-2xl font-bold sm:text-4xl")}>
      {children}
      {/* <GradientText>{children}</GradientText> */}
    </h1>
  );
};
