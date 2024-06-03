import React, { FC, useCallback, useMemo, useState } from "react";
import { firstValueFrom, Subject } from "rxjs";

import { CommonProps, ConfirmProps, Popup, PopupProps } from "@src/components/shared/Popup";

type ConfirmPopupProps = string | (Omit<CommonProps, "onClose" | "open"> & Omit<ConfirmProps, "onValidate" | "onCancel" | "variant">);

type PopupProviderContext = {
  confirm: (messageOrProps: ConfirmPopupProps) => Promise<boolean>;
};

const PopupContext = React.createContext<PopupProviderContext | undefined>(undefined);

export const PopupProvider: FC = ({ children }) => {
  const [popupProps, setPopupProps] = useState<PopupProps | undefined>();

  const confirm = useCallback(
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

  const context = useMemo(() => ({ confirm }), [confirm]);

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
