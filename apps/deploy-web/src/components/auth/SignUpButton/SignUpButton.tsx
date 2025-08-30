import { useCallback, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import Link from "next/link";

import { useServices } from "@src/context/ServicesProvider";

export interface Props {
  children?: React.ReactNode;
  className?: string;
  wrapper?: "button" | "link";
  [key: string]: any;
}

export const SignUpButton: React.FC<Props> = ({ children, className, wrapper = "link", ...props }) => {
  const { authService } = useServices();
  const [isLoading, setIsLoading] = useState(false);
  const signup = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsLoading(true);
    authService.signup().finally(() => setIsLoading(false));
  }, []);

  const content = children || "Sign up";
  switch (wrapper) {
    case "button":
      return (
        <Button className={className} onClick={signup} disabled={isLoading} {...props}>
          {content}
        </Button>
      );
    default:
      return (
        <Link href="#" passHref prefetch={false} className={className} onClick={signup} aria-disabled={isLoading} {...props}>
          {content}
        </Link>
      );
  }
};
