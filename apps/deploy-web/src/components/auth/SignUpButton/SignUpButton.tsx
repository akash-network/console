import { Button } from "@akashnetwork/ui/components";
import Link from "next/link";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";

export interface Props {
  children?: React.ReactNode;
  className?: string;
  wrapper?: "button" | "link";
  dependencies?: typeof DEPENDENCIES;
  [key: string]: any;
}

export const DEPENDENCIES = {
  Button,
  Link,
  useServices,
  useRouter
};

export const SignUpButton: React.FC<Props> = ({ children, className, wrapper = "link", dependencies: d = DEPENDENCIES, ...props }) => {
  const content = children || "Sign up";
  const { urlService } = d.useServices();
  const router = d.useRouter();

  switch (wrapper) {
    case "button":
      return (
        <d.Button className={className} onClick={() => router.push(urlService.newSignup())} {...props}>
          {content}
        </d.Button>
      );
    default:
      return (
        <d.Link href={urlService.newSignup()} passHref prefetch={false} className={className} {...props}>
          {content}
        </d.Link>
      );
  }
};
