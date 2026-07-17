import type { FC } from "react";
import { Input } from "@akashnetwork/ui/components";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Disabled once quotes are requested, matching the rest of the deployment pane. */
  disabled?: boolean;
};

export const DeploymentNameField: FC<Props> = ({ value, onChange, disabled }) => (
  <div className="space-y-2">
    <div className="px-1 font-mono text-xs uppercase text-muted-foreground">Name</div>
    <Input
      inputClassName="h-9"
      aria-label="Deployment name"
      placeholder="Name your deployment"
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
    />
  </div>
);
