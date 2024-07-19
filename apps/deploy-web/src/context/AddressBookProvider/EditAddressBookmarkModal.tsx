"use client";
import { ReactNode, useEffect, useState } from "react";
import { Input, Label, Popup, Snackbar } from "@akashnetwork/ui/components";
import { Bin, Check } from "iconoir-react";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { FormPaper } from "@src/components/sdl/FormPaper";
import { getSplitText } from "@src/hooks/useShortText";
import { useRemoveAddressName, useSaveAddressName } from "@src/queries/useAddressNames";
import { AnalyticsEvents } from "@src/utils/analytics";

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
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      setCustomName(addressNames[_address] || "");
    }
  }, [open]);

  async function onSaveClick() {
    await saveAddress(customName);

    enqueueSnackbar(<Snackbar title="Address saved!" iconVariant="success" />, {
      variant: "success"
    });

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
          <Label>Address</Label>
          <Input
            placeholder="Address"
            value={_address}
            onChange={ev => setAddress(ev.target.value)}
            // Disabled if saving, deleting or if there is an address
            disabled={isSaving || isDeleting || !!address}
            className="w-full"
          />
        </div>

        <div className="w-full">
          <Label>Custom name</Label>
          <Input
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
