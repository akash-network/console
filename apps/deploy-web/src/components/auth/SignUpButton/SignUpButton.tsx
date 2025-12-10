import { Button } from "@akashnetwork/ui/components";
import { useMutation } from "@tanstack/react-query";
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
  const signup = useMutation<void, Error, React.MouseEvent>({
    async mutationFn(event) {
      event.preventDefault();
      await authService.loginViaOauth();
    }
  });

  const content = children || "Sign up";
  switch (wrapper) {
    case "button":
      return (
        <Button className={className} onClick={signup.mutate} disabled={signup.isPending} {...props}>
          {content}
        </Button>
      );
    default:
      return (
        <Link href="#" passHref prefetch={false} className={className} onClick={signup.mutate} aria-disabled={signup.isPending} {...props}>
          {content}
        </Link>
      );
  }
};
