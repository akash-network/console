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
  const content = children || "Sign up";
  const { urlService, router } = useServices();
  switch (wrapper) {
    case "button":
      return (
        <Button className={className} onClick={() => router.push(urlService.newSignup())} {...props}>
          {content}
        </Button>
      );
    default:
      return (
        <Link href={urlService.newSignup()} passHref prefetch={false} className={className} {...props}>
          {content}
        </Link>
      );
  }
};
