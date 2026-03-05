import { Button } from "@akashnetwork/ui/components";

import { ColoredGoogleIcon } from "@src/components/icons/ColoredGoogleIcon";
import { GithubIcon } from "@src/components/icons/GithubIcon";

export interface Props {
  buttonPrefix?: string;
  onSocialLogin: (provider: "github" | "google-oauth2") => void;
}

export function SocialAuth(props: Props) {
  const buttonPrefix = props.buttonPrefix ? `${props.buttonPrefix} ` : "";
  return (
    <div className="flex flex-col items-start justify-start gap-4 self-stretch sm:flex-row">
      <Button
        type="button"
        onClick={() => props.onSocialLogin("github")}
        variant="outline"
        className="h-9 w-full flex-1 justify-center gap-2 border-neutral-200 dark:border-neutral-800"
      >
        <GithubIcon />
        <span className="hidden sm:inline">{buttonPrefix}GitHub</span>
        <span className="sm:hidden">GitHub</span>
      </Button>
      <Button
        type="button"
        onClick={() => props.onSocialLogin("google-oauth2")}
        variant="outline"
        className="h-9 w-full flex-1 justify-center gap-2 border-neutral-200 dark:border-neutral-800"
      >
        <ColoredGoogleIcon />
        <span className="hidden sm:inline">{buttonPrefix}Google</span>
        <span className="sm:hidden">Google</span>
      </Button>
    </div>
  );
}
