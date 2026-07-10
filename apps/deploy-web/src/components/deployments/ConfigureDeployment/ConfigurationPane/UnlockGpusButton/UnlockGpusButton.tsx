import type { FC } from "react";
import { Button, CustomTooltip, TooltipProvider } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

/** Hover explanation for the unlock CTA; mirrors the add-credits sheet copy so the reason is clear before the click. */
const UNLOCK_EXPLANATION = "High-end GPUs aren't included in your free trial. Add credits to unlock them, along with longer runtimes and the full Console.";

type Props = {
  /** Opens the add-credits (unlock) sheet owned by the HardwareSection. */
  onUnlock?: () => void;
};

/**
 * The "Unlock high-end GPUs" call-to-action the Presets and GPU cards show when the trial blocks a
 * model: opens the add-credits sheet on click and explains why on hover. Wraps its own
 * `TooltipProvider` so it works wherever it's rendered without the consumer supplying one.
 */
export const UnlockGpusButton: FC<Props> = ({ onUnlock }) => (
  <TooltipProvider>
    <CustomTooltip title={UNLOCK_EXPLANATION} className="font-sans text-sm normal-case">
      <Button type="button" variant="ghost" size="sm" className="justify-start px-2 text-muted-foreground" onClick={onUnlock}>
        <LockIcon className="mr-2 h-3.5 w-3.5" />
        Unlock high-end GPUs
      </Button>
    </CustomTooltip>
  </TooltipProvider>
);
