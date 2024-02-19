"use client";
import { ReactNode } from "react";
import { Popup } from "../shared/Popup";
import { Control, Controller } from "react-hook-form";
import { SdlBuilderFormValues } from "@src/types";
import { Card, CardContent } from "../ui/card";
import { FormInput, Textarea } from "../ui/input";

type Props = {
  serviceIndex: number;
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

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
      <Card className="flex p-4">
        <CardContent className="flex-grow">
          <Controller
            control={control}
            name={`services.${serviceIndex}.command.command`}
            render={({ field }) => (
              <FormInput
                type="text"
                // variant="outlined"
                label="Command"
                // color="secondary"
                // fullWidth
                value={field.value}
                placeholder="Example: bash -c"
                // size="small"
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />

          <Controller
            control={control}
            name={`services.${serviceIndex}.command.arg`}
            render={({ field }) => (
              <div className="mt-2">
                <label>Arguments</label>
                <Textarea
                  aria-label="Args"
                  placeholder="Example: apt-get update; apt-get install -y --no-install-recommends -- ssh;"
                  className="w-full px-4 py-2 text-sm"
                  // style={{ width: "100%", padding: ".5rem 1rem", fontFamily: "inherit", fontSize: ".8rem" }}
                  value={field.value}
                  rows={4}
                  spellCheck={false}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>
    </Popup>
  );
};
