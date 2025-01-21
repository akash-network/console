import React, { useCallback, useMemo, useState } from "react";
import { CommonProps, ConfirmProps, CustomPrompt, Popup, PopupProps, SelectOption, SelectProps } from "@akashnetwork/ui/components";
import { firstValueFrom, Subject } from "rxjs";

type ConfirmPopupProps = string | (Omit<CommonProps, "onClose" | "open"> & Omit<ConfirmProps, "onValidate" | "onCancel" | "variant">);
type SelectPopupProps = Omit<CommonProps, "onClose" | "open"> & Omit<SelectProps, "onValidate" | "onCancel" | "variant">;
type CustomPopupProps = Omit<CommonProps, "onClose" | "open"> & Omit<CustomPrompt, "onValidate" | "onCancel" | "variant">;

type PopupProviderContext = {
  confirm: (messageOrProps: ConfirmPopupProps) => Promise<boolean>;
  select: (props: SelectPopupProps) => Promise<string | undefined>;
  requireAction: (props: CustomPopupProps) => Promise<undefined>;
  createCustom: (props: CustomPopupProps) => void;
};

const PopupContext = React.createContext<PopupProviderContext | undefined>(undefined);

export const PopupProvider = ({ children }: React.PropsWithChildren) => {
  const [popupProps, setPopupProps] = useState<PopupProps | undefined>();

  const confirm: PopupProviderContext["confirm"] = useCallback(
    (messageOrProps: ConfirmPopupProps) => {
      let subject: Subject<boolean> | undefined = new Subject<boolean>();

      const closeWithResult = (result: boolean) => () => {
        if (subject) {
          subject.next(result);
          subject.complete();
          setPopupProps(undefined);
          subject = undefined;
        }
      };
      const reject = closeWithResult(false);
      const props = typeof messageOrProps === "string" ? { message: messageOrProps } : messageOrProps;

      setPopupProps({
        title: "Confirm",
        ...props,
        open: true,
        variant: "confirm",
        onValidate: closeWithResult(true),
        onCancel: reject,
        onClose: reject
      });

      return firstValueFrom(subject);
    },
    [setPopupProps]
  );

  const select: PopupProviderContext["select"] = useCallback(
    props => {
      let subject: Subject<SelectOption["value"] | undefined> | undefined = new Subject<SelectOption["value"] | undefined>();

      const reject = () => {
        if (subject) {
          subject.next(undefined);
          subject.complete();
          setPopupProps(undefined);
          subject = undefined;
        }
      };

      setPopupProps({
        title: "Confirm",
        ...props,
        open: true,
        variant: "select",
        onValidate: value => {
          if (subject) {
            subject.next(value);
            subject.complete();
            setPopupProps(undefined);
            subject = undefined;
          }
        },
        onCancel: reject,
        onClose: reject
      });

      return firstValueFrom(subject);
    },
    [setPopupProps]
  );

  const requireAction: PopupProviderContext["requireAction"] = useCallback(
    (props: CustomPopupProps) => {
      let subject: Subject<SelectOption["value"] | undefined> | undefined = new Subject<SelectOption["value"] | undefined>();

      const close = () => {
        if (subject) {
          subject.next(undefined);
          subject.complete();
          setPopupProps(undefined);
          subject = undefined;
        }
      };

      setPopupProps({
        title: "Action Required",
        ...props,
        actions: typeof props.actions === "function" ? props.actions({ close }) : props.actions,
        open: true,
        variant: "custom",
        onClose: close
      });

      return firstValueFrom(subject).then(() => undefined);
    },
    [setPopupProps]
  );

  const createCustom: PopupProviderContext["createCustom"] = useCallback(
    (props: CustomPopupProps) => {
      const close = () => {
        setPopupProps(undefined);
      };
      setPopupProps({
        ...props,
        actions: typeof props.actions === "function" ? props.actions({ close }) : props.actions,
        variant: "custom",
        open: true,
        onClose: close
      });
    },
    [setPopupProps]
  );

  const context = useMemo(() => ({ confirm, select, requireAction, createCustom }), [confirm, select, requireAction, createCustom]);

  return (
    <PopupContext.Provider value={context}>
      {children}
      {popupProps && <Popup {...popupProps} />}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = React.useContext(PopupContext);
  if (!context) {
    throw new Error("usePopup must be used within a PopupProvider");
  }
  return context;
};
