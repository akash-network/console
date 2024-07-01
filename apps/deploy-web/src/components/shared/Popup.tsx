import * as React from "react";
import { useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  Button,
  ButtonProps,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle as _DialogTitle,
  InputWithIcon,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner
} from "@akashnetwork/ui/components";
import { DialogProps } from "@radix-ui/react-dialog";

import { cn } from "@src/utils/styleUtils";
import { ErrorFallback } from "./ErrorFallback";

type MessageProps = {
  variant: "message";
  onValidate: () => void;
};

export type ConfirmProps = {
  variant: "confirm";
  onValidate: () => void;
  onCancel: () => void;
};

type PromptProps = {
  variant: "prompt";
  onValidate: (data: string) => void;
  onCancel: () => void;
};

type CustomPrompt = {
  variant: "custom";
  actions: ActionButton[];
};

export type SelectOption = {
  text: string;
  value: string;
  selected?: boolean;
  disabled?: boolean;
};

export type SelectProps = {
  variant: "select";
  options: SelectOption[];
  placeholder?: string;
  onValidate: (value: string | undefined) => void;
  onCancel: () => void;
};

export type TOnCloseHandler = {
  (event: any, reason: "backdropClick" | "escapeKeyDown" | "action"): void;
};

export type CommonProps = {
  title?: string | React.ReactNode;
  message?: string;
  open?: boolean;
  onClose?: TOnCloseHandler;
  fullWidth?: boolean;
  dividers?: boolean;
  maxWidth?: false | "xs" | "sm" | "md" | "lg" | "xl";
  dialogProps?: Partial<DialogProps>;
  fixedTopPosition?: boolean;
  enableCloseOnBackdropClick?: boolean;
  hideCloseButton?: boolean;
  testId?: string;
};

export type ActionButtonSide = "left" | "right";

export type ActionButton = ButtonProps & {
  label: string | React.ReactNode;
  side: ActionButtonSide;
  isLoading?: boolean;
  "data-testid"?: string;
};

export type PopupProps = (MessageProps | ConfirmProps | PromptProps | CustomPrompt | SelectProps) & CommonProps;

export interface DialogTitleProps {
  children: React.ReactNode;
}

export const DialogTitle = (props: DialogTitleProps) => {
  const { children, ...other } = props;

  return (
    <DialogHeader>
      <_DialogTitle {...other}>
        <span className="text-lg">{children}</span>
      </_DialogTitle>
    </DialogHeader>
  );
};

export function Popup(props: React.PropsWithChildren<PopupProps>) {
  const [promptInput, setPromptInput] = React.useState("");
  const initialOption = useMemo(() => (props.variant === "select" ? props.options.find(option => option.selected)?.value : undefined), [props]);
  const [selectOption, setSelectOption] = React.useState<SelectOption["value"] | undefined>(initialOption);
  const component = [] as JSX.Element[];

  const onClose: TOnCloseHandler = (event, reason) => {
    setPromptInput("");
    props.onClose?.(event, reason);
  };

  const ConfirmButtonLabel = "Confirm";
  const CancelButtonLabel = "Cancel";

  const dialogProps: DialogProps = {
    open: !!props.open,
    ...props.dialogProps
  };

  if (props.title) {
    component.push(<DialogTitle key="dialog-title">{props.title}</DialogTitle>);
  }

  if (props.variant === "select") {
    component.push(
      <ScrollArea className="max-h-[75vh]" key="dialog-content">
        {props.message}
        {props.variant === "select" ? (
          <Select value={selectOption} onValueChange={setSelectOption}>
            <SelectTrigger>
              <SelectValue placeholder={props.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {props.options.map((option: SelectOption) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.text}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  } else if (props.message && props.variant !== "prompt") {
    component.push(
      <ScrollArea className="max-h-[75vh]" key="dialog-content">
        {props.message}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  } else {
    component.push(
      <ScrollArea key="dialog-content" className="-mx-4 max-h-[75vh]">
        <div className="p-4">
          {props.variant === "prompt" ? (
            <InputWithIcon
              label={props.message}
              value={promptInput}
              // eslint-disable-next-line no-void
              onChange={_ => void setPromptInput(_.target.value)}
              className="w-full"
            />
          ) : (
            props.children
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  }

  switch (props.variant) {
    case "confirm":
      component.push(
        <DialogFooter key="dialog-actions" className="justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              props.onCancel();
              onClose(null, "action");
            }}
          >
            {CancelButtonLabel}
          </Button>
          <Button
            variant="default"
            color="priamry"
            onClick={() => {
              props.onValidate();
              onClose(null, "action");
            }}
          >
            {ConfirmButtonLabel}
          </Button>
        </DialogFooter>
      );
      break;
    case "prompt":
      component.push(
        <DialogFooter key="DialogActions" className="justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              props.onCancel();
              onClose(null, "action");
            }}
          >
            {CancelButtonLabel}
          </Button>
          <Button
            variant="default"
            color="primary"
            onClick={() => {
              props.onValidate(promptInput);
              onClose(null, "action");
            }}
          >
            {ConfirmButtonLabel}
          </Button>
        </DialogFooter>
      );
      break;
    case "message":
      component.push(
        <DialogFooter key="DialogActions">
          <Button
            variant="default"
            color="primary"
            onClick={() => {
              props.onValidate();
              onClose(null, "action");
            }}
          >
            {ConfirmButtonLabel}
          </Button>
        </DialogFooter>
      );
      break;
    case "custom": {
      const leftButtons = props.actions
        ?.filter(x => x.side === "left")
        .map(({ isLoading, side, label, ...rest }, idx) => (
          <Button key={`dialog-action-button-${idx}`} {...rest}>
            {isLoading ? <Spinner size="small" /> : label}
          </Button>
        ));
      const rightButtons = props.actions
        ?.filter(x => x.side === "right")
        .map(({ isLoading, side, label, ...rest }, idx) => (
          <Button key={`dialog-action-button-${idx}`} {...rest}>
            {isLoading ? <Spinner size="small" /> : label}
          </Button>
        ));
      component.push(
        <DialogFooter className="flex flex-row justify-between space-x-2 sm:justify-between" key="DialogCustomActions">
          <div className="space-x-2">{leftButtons}</div>
          <div className="space-x-2">{rightButtons}</div>
        </DialogFooter>
      );
      break;
    }
    case "select": {
      component.push(
        <DialogFooter key="DialogActions" className="justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              props.onCancel();
              onClose(null, "action");
            }}
          >
            {CancelButtonLabel}
          </Button>
          <Button
            variant="default"
            color="primary"
            onClick={() => {
              props.onValidate(selectOption);
              onClose(null, "action");
            }}
          >
            {ConfirmButtonLabel}
          </Button>
        </DialogFooter>
      );
      break;
    }
  }

  /**
   * Prevent close because of click on backdrop unless enabled through the setting 'enableCloseOnBackdropClick'.
   */
  const handleOnClose = (open: boolean) => {
    if (!open && props.onClose) {
      props.onClose(null, "action");
    }
  };

  return (
    <Dialog key="Dialog" {...dialogProps} onOpenChange={handleOnClose}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <DialogContent
          className={cn("m-0 p-4", {
            ["sm:max-w-[400px]"]: props.maxWidth === "xs",
            ["sm:max-w-[600px]"]: props.maxWidth === "sm",
            ["sm:max-w-[750px]"]: props.maxWidth === "md",
            ["sm:max-w-[950px]"]: props.maxWidth === "lg",
            ["sm:max-w-[900px]"]: props.maxWidth === "xl"
          })}
          hideCloseButton={props.hideCloseButton}
        >
          {component}
        </DialogContent>
      </ErrorBoundary>
    </Dialog>
  );
}
