import React, { useCallback, useMemo, useState } from "react";
import { CommonProps, ConfirmProps, Popup, PopupProps, SelectOption, SelectProps } from "@akashnetwork/ui/components";
import { firstValueFrom, Subject } from "rxjs";

type ConfirmPopupProps = string | (Omit<CommonProps, "onClose" | "open"> & Omit<ConfirmProps, "onValidate" | "onCancel" | "variant">);
type SelectPopupProps = Omit<CommonProps, "onClose" | "open"> & Omit<SelectProps, "onValidate" | "onCancel" | "variant">;

type PopupProviderContext = {
  confirm: (messageOrProps: ConfirmPopupProps) => Promise<boolean>;
  select: (props: SelectPopupProps) => Promise<string | undefined>;
};

const PopupContext = React.createContext<PopupProviderContext | undefined>(undefined);

export const PopupProvider = ({ children }: React.PropsWithChildren<{}>) => {
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

  const context = useMemo(() => ({ confirm, select }), [confirm]);

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
