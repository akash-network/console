import { ReactNode, useEffect, useState } from "react";
import { Popup } from "../shared/Popup";
import { Box, Paper, TextField } from "@mui/material";
import { getSplitText } from "@src/hooks/useShortText";
import CheckIcon from "@mui/icons-material/Check";
import { useRemoveAddressName, useSaveAddressName } from "@src/queries/useAddressNames";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSnackbar } from "notistack";
import { Snackbar } from "../shared/Snackbar";
import { event } from "nextjs-google-analytics";
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
  const { mutate: saveAddress, isLoading: isSaving } = useSaveAddressName(address);
  const { mutate: deleteAddress, isLoading: isDeleting } = useRemoveAddressName(address);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      setCustomName(addressNames[address] || "");
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
      title={addressNames[address] ? <>Edit {getSplitText(address)} name</> : <>Add {getSplitText(address)} to Address Book</>}
      actions={[
        {
          label: (
            <>
              Remove&nbsp;
              <DeleteIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "left",
          disabled: isSaving || isDeleting || !(address in addressNames),
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
              <CheckIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !customName || isSaving || isDeleting,
          onClick: onSaveClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="sm"
      enableCloseOnBackdropClick={!isSaving && !isDeleting}
    >
      <Paper elevation={2} sx={{ display: "flex", padding: "1rem" }}>
        <Box sx={{ flexGrow: 1 }}>
          <TextField
            placeholder="Your custom name"
            value={customName}
            onChange={ev => setCustomName(ev.target.value)}
            disabled={isSaving || isDeleting}
            fullWidth
          />
        </Box>
      </Paper>
    </Popup>
  );
};
