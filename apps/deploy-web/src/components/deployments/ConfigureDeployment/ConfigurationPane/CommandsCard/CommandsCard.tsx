"use client";
import { type FC, useCallback, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import {
  Button,
  CollapsibleCard,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Field,
  FieldContent,
  FieldLabel,
  Textarea
} from "@akashnetwork/ui/components";
import { ChevronRightIcon, SaveIcon, TerminalIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { commandsTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, DialogV2, DialogV2Content, DialogV2Header, DialogV2Title, DialogV2Description, DialogV2Body, DialogV2Footer };

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * "Commands" card. Edits `services.${serviceIndex}.command.{command,arg}` on the
 * shared deployment model — the container's CMD/ENTRYPOINT override. The command
 * textarea holds one argv token per line (the SDL generator tokenizes by line);
 * leaving it blank keeps the image's default. Arguments are emitted as the SDL
 * `args` list only when a command is set.
 *
 * The card is non-collapsible: its header summarizes the current command (or notes the
 * image default) and clicking it opens a Dialog for editing. Changes are committed on
 * Save and reverted on Cancel.
 */
export const CommandsCard: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const command = useController({ control, name: `services.${serviceIndex}.command.command` });
  const arg = useController({ control, name: `services.${serviceIndex}.command.arg` });
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{ command: string; arg: string } | null>(null);

  const openModal = useCallback(() => {
    setSnapshot({
      command: getValues(`services.${serviceIndex}.command.command`) ?? "",
      arg: getValues(`services.${serviceIndex}.command.arg`) ?? ""
    });
    setOpen(true);
  }, [getValues, serviceIndex]);

  const handleCancel = useCallback(() => {
    if (snapshot) {
      setValue(`services.${serviceIndex}.command.command`, snapshot.command, { shouldDirty: true });
      setValue(`services.${serviceIndex}.command.arg`, snapshot.arg, { shouldDirty: true });
    }
    setOpen(false);
  }, [setValue, snapshot, serviceIndex]);

  const handleSave = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <d.CollapsibleCard
        title="Commands"
        icon={<TerminalIcon className="h-4 w-4" />}
        infoTooltip={commandsTooltip}
        summary={<ChevronRightIcon />}
        onHeaderClick={openModal}
      />

      <d.DialogV2
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) handleCancel();
        }}
      >
        <d.DialogV2Content className="max-w-lg" aria-describedby="commands-description">
          <d.DialogV2Header>
            <d.DialogV2Title>Edit commands</d.DialogV2Title>
            <d.DialogV2Description id="commands-description">
              Override the container's default CMD/ENTRYPOINT. Leave Command blank to keep the image's default.
            </d.DialogV2Description>
          </d.DialogV2Header>

          <d.DialogV2Body className="flex flex-col gap-4">
            <fieldset className="contents">
              <Field className="gap-2">
                <FieldLabel htmlFor={`command-${serviceIndex}`}>Command</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={`command-${serviceIndex}`}
                    aria-label="Command"
                    rows={4}
                    placeholder={"One token per line. Example:\nsh\n-c"}
                    value={command.field.value ?? ""}
                    onChange={event => command.field.onChange(event.target.value)}
                    spellCheck={false}
                  />
                </FieldContent>
              </Field>

              <Field className="gap-2">
                <FieldLabel htmlFor={`command-arg-${serviceIndex}`}>Arguments</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={`command-arg-${serviceIndex}`}
                    aria-label="Arguments"
                    rows={4}
                    placeholder="Example: apt-get update; apt-get install -y --no-install-recommends -- ssh;"
                    value={arg.field.value ?? ""}
                    onChange={event => arg.field.onChange(event.target.value)}
                    spellCheck={false}
                  />
                </FieldContent>
              </Field>
            </fieldset>
          </d.DialogV2Body>

          <d.DialogV2Footer className="flex items-center">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save
              <SaveIcon className="ml-2 size-4" />
            </Button>
          </d.DialogV2Footer>
        </d.DialogV2Content>
      </d.DialogV2>
    </>
  );
};
