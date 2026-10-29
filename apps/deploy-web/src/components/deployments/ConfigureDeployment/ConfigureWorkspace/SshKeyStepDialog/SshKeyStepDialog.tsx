import type { FC, FormEvent } from "react";
import { useEffect, useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SshPublicKeyField } from "../../ConfigurationPane/SshPublicKeyField/SshPublicKeyField";

export const DEPENDENCIES = { SshPublicKeyField, useServices };

export type SshKeyStepSource = "setup" | "choose_provider";

type CompletionMethod = "pasted" | "generated";

type Props = {
  source: SshKeyStepSource;
  serviceIndex: number;
  onContinue: () => void;
  onDismiss: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const REASON_BY_SOURCE: Record<SshKeyStepSource, string> = {
  setup: "You sign in to your VM with an SSH key.",
  choose_provider: "Your VM needs an SSH key before you can choose a provider."
};

/** Writes the key straight into the form, so a dismissed step keeps what was typed for the Operating System card. */
export const SshKeyStepDialog: FC<Props> = ({ source, serviceIndex, onContinue, onDismiss, dependencies: d = DEPENDENCIES }) => {
  const descriptionId = useId();
  const { analyticsService } = d.useServices();
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const sshPubKey = useWatch({ control, name: `services.${serviceIndex}.sshPubKey` });
  const hasKey = !!sshPubKey?.trim();

  useEffect(
    function trackStepOpened() {
      analyticsService.track("configure_ssh_key_step_opened", { category: "deployments", source });
    },
    [analyticsService, source]
  );

  function complete(method: CompletionMethod) {
    analyticsService.track("configure_ssh_key_step_completed", { category: "deployments", source, method });
    onContinue();
  }

  function continueWithPastedKey(event: FormEvent) {
    event.preventDefault();
    if (hasKey) complete("pasted");
  }

  function dismiss() {
    analyticsService.track("configure_ssh_key_step_dismissed", { category: "deployments", source });
    onDismiss();
  }

  return (
    <DialogV2
      open
      onOpenChange={open => {
        if (!open) dismiss();
      }}
    >
      <DialogV2Content className="max-w-lg" aria-describedby={descriptionId}>
        <form onSubmit={continueWithPastedKey} className="flex min-h-0 flex-col">
          <DialogV2Header>
            <DialogV2Title>Add an SSH key</DialogV2Title>
            <DialogV2Description id={descriptionId}>
              {REASON_BY_SOURCE[source]} Paste your public key or generate a new pair. A generated pair downloads as keypair.zip, which holds your private key,
              so keep it safe.
            </DialogV2Description>
          </DialogV2Header>
          <DialogV2Body>
            <d.SshPublicKeyField serviceIndex={serviceIndex} validateOnBlur={false} onKeyGenerated={() => complete("generated")} />
          </DialogV2Body>
          <DialogV2Footer>
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
            <Button type="submit" disabled={!hasKey}>
              Continue
            </Button>
          </DialogV2Footer>
        </form>
      </DialogV2Content>
    </DialogV2>
  );
};
