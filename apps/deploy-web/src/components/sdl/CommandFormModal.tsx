"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";

import { SdlBuilderFormValues } from "@src/types";
import { Popup } from "../shared/Popup";
import { FormInput, Textarea } from "../ui/input";
import { Label } from "../ui/label";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

export const CommandFormModal: React.FunctionComponent<Props> = ({ control, serviceIndex, onClose }) => {
  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Edit Commands"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "ghost",
          side: "right",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
    >
      <FormPaper className="!bg-popover">
        <Controller
          control={control}
          name={`services.${serviceIndex}.command.command`}
          render={({ field }) => (
            <FormInput type="text" label="Command" value={field.value} placeholder="Example: bash -c" onChange={event => field.onChange(event.target.value)} />
          )}
        />

        <Controller
          control={control}
          name={`services.${serviceIndex}.command.arg`}
          render={({ field }) => (
            <div className="mt-2">
              <Label>Arguments</Label>
              <Textarea
                aria-label="Args"
                placeholder="Example: apt-get update; apt-get install -y --no-install-recommends -- ssh;"
                className="mt-2 w-full px-4 py-2 text-sm"
                value={field.value}
                rows={4}
                spellCheck={false}
                onChange={field.onChange}
              />
            </div>
          )}
        />
      </FormPaper>
    </Popup>
  );
};
