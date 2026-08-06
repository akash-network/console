import type { FC } from "react";
import { Button, CustomTooltip, TooltipProvider } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

/** Hover explanation for the unlock CTA; mirrors the add-credits sheet copy so the reason is clear before the click. */
const UNLOCK_EXPLANATION = "High-end GPUs aren't included in your free trial. Add credits to unlock them, along with longer runtimes and the full Console.";

type Props = {
  /** Opens the add-credits (unlock) sheet owned by the HardwareSection. */
  onUnlock?: () => void;
  /**
   * Renders a filled primary button when this is the alert's main call-to-action (the trial confidential-compute
   * warning), instead of the subtle ghost affordance shown beneath the Presets and GPU cards.
   */
  prominent?: boolean;
  /** Button text; defaults to the high-end GPU copy used by the Presets/GPU cards. */
  label?: string;
  /** Hover explanation; defaults to the high-end GPU copy used by the Presets/GPU cards. */
  explanation?: string;
};

/**
 * The unlock call-to-action shown when the trial blocks a feature (high-end GPU models by default,
 * with copy overridable for other gated features like the GPU interconnect): opens the add-credits
 * sheet on click and explains why on hover. Wraps its own `TooltipProvider` so it works wherever
 * it's rendered without the consumer supplying one.
 */
export const UnlockGpusButton: FC<Props> = ({ onUnlock, prominent = false, label = "Unlock high-end GPUs", explanation = UNLOCK_EXPLANATION }) => (
  <TooltipProvider>
    <CustomTooltip title={explanation} className="font-sans text-sm normal-case">
      <Button
        type="button"
        variant={prominent ? "default" : "ghost"}
        size="sm"
        className={prominent ? undefined : "justify-start px-2 text-muted-foreground"}
        onClick={onUnlock}
      >
        <LockIcon className="mr-2 h-3.5 w-3.5" />
        {label}
      </Button>
    </CustomTooltip>
  </TooltipProvider>
);
