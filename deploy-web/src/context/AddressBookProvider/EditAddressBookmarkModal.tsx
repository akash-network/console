"use client";
import { ReactNode, useEffect, useState } from "react";
import { getSplitText } from "@src/hooks/useShortText";
import { useRemoveAddressName, useSaveAddressName } from "@src/queries/useAddressNames";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useToast } from "@src/components/ui/use-toast";
import { Popup } from "@src/components/shared/Popup";
import { Bin, Check } from "iconoir-react";
import { InputWithIcon } from "@src/components/ui/input";
import { FormPaper } from "@src/components/sdl/FormPaper";

type Props = {
  open: boolean;
  onClose: () => void;
  address: string;
  addressNames: { [key: string]: string };
  children?: ReactNode;
};

export const EditAddressBookmarkModal: React.FunctionComponent<Props> = ({ open, address, addressNames, onClose }) => {
  const [customName, setCustomName] = useState<string>("");
  const [_address, setAddress] = useState(address);
  const { mutate: saveAddress, isLoading: isSaving } = useSaveAddressName(_address);
  const { mutate: deleteAddress, isLoading: isDeleting } = useRemoveAddressName(_address);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setCustomName(addressNames[_address] || "");
    }
  }, [open]);

  async function onSaveClick() {
    await saveAddress(customName);

    toast({ title: "Address saved!", variant: "success" });

    event(AnalyticsEvents.ADDRESS_BOOK_SAVE_ADDRESS, {
      category: "settings",
      label: "Save address for address book"
    });

    onClose();
  }

  async function onDeleteClick() {
    await deleteAddress();

    event(AnalyticsEvents.ADDRESS_BOOK_REMOVE_ADDRESS, {
      category: "settings",
      label: "Remove address from address book"
    });

    onClose();
  }

  function onCloseClick() {
    onClose();
  }

  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title={addressNames[_address] ? <>Edit {getSplitText(_address)} name</> : <>Add {getSplitText(_address)} to Address Book</>}
      actions={[
        {
          label: (
            <>
              Remove
              <Bin className="ml-2 text-xs" />
            </>
          ),
          variant: "ghost",
          side: "left",
          disabled: isSaving || isDeleting || !(_address in addressNames),
          onClick: onDeleteClick
        },
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "right",
          disabled: isSaving || isDeleting,
          onClick: onClose
        },
        {
          label: (
            <>
              Save&nbsp;
              <Check />
            </>
          ),
          variant: "default",
          side: "right",
          disabled: !customName || isSaving || isDeleting,
          onClick: onSaveClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="sm"
      enableCloseOnBackdropClick={!isSaving && !isDeleting}
    >
      <FormPaper contentClassName="flex items-center p-4 flex-col space-y-2">
        <div className="w-full">
          <InputWithIcon
            label="Address"
            placeholder="Address"
            value={_address}
            onChange={ev => setAddress(ev.target.value)}
            // Disabled if saving, deleting or if there is an address
            disabled={isSaving || isDeleting || !!address}
            className="w-full"
          />
        </div>

        <div className="w-full">
          <InputWithIcon
            label="Custom name"
            placeholder="Your custom name"
            value={customName}
            onChange={ev => setCustomName(ev.target.value)}
            disabled={isSaving || isDeleting}
            className="w-full"
          />
        </div>
      </FormPaper>
    </Popup>
  );
};
