import type { FC } from "react";
import { useId, useState } from "react";
import {
  Button,
  CustomNoDivTooltip,
  DialogV2,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";
import { RotateCcwIcon } from "lucide-react";

const RESET_LABEL = "Reset configuration";

type Props = {
  disabled?: boolean;
  onReset: () => void;
};

export const ResetConfigurationButton: FC<Props> = ({ disabled = false, onReset }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const descriptionId = useId();

  function confirmReset() {
    setIsConfirming(false);
    onReset();
  }

  return (
    <>
      <CustomNoDivTooltip title={RESET_LABEL}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={RESET_LABEL}
          disabled={disabled}
          onClick={() => setIsConfirming(true)}
          className="h-8 w-8 rounded-full"
        >
          <RotateCcwIcon className="h-4 w-4" />
        </Button>
      </CustomNoDivTooltip>
      <DialogV2 open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogV2Content className="max-w-md" aria-describedby={descriptionId}>
          <DialogV2Header>
            <DialogV2Title>Start over?</DialogV2Title>
            <DialogV2Description id={descriptionId}>This restores the configuration you started with. Your changes won&apos;t be kept.</DialogV2Description>
          </DialogV2Header>
          <DialogV2Footer className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmReset}>
              Reset
            </Button>
          </DialogV2Footer>
        </DialogV2Content>
      </DialogV2>
    </>
  );
};
