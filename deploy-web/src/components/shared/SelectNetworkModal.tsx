import {
  Alert,
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  Typography
} from "@mui/material";
import { mainnetId } from "@src/utils/constants";
import { networks } from "@src/utils/networks";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";
import { useSettings } from "../../context/SettingsProvider";
import { Popup } from "./Popup";

const useStyles = makeStyles()(theme => ({
  experimentalChip: {
    height: "16px",
    marginLeft: "1rem",
    fontSize: ".7rem",
    fontWeight: "bold"
  },
  version: {
    fontWeight: "bold"
  },
  alert: {
    marginBottom: "1rem"
  }
}));

export const SelectNetworkModal = ({ onClose }) => {
  const { classes } = useStyles();
  const { selectedNetworkId } = useSettings();
  const [localSelectedNetworkId, setLocalSelectedNetworkId] = useState(selectedNetworkId);

  const handleSelectNetwork = network => {
    setLocalSelectedNetworkId(network.id);
  };

  const handleSaveChanges = () => {
    if (selectedNetworkId !== localSelectedNetworkId) {
      // Set in the settings and local storage
      localStorage.setItem("selectedNetworkId", localSelectedNetworkId);
      // Reset the ui to reload the settings for the currently selected network

      location.reload();
    } else {
      onClose();
    }
  };

  return (
      <Popup
      fullWidth
      open
      variant="custom"
      title="Select Network"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Save",
          color: "secondary",
          variant: "contained",
          side: "right",
          onClick: handleSaveChanges
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
    >
        <List>
          {networks.map(network => {
            return (
              <ListItemButton key={network.id} dense onClick={() => handleSelectNetwork(network)} disabled={!network.enabled}>
                <ListItemIcon>
                  <Radio checked={localSelectedNetworkId === network.id} value={network.id} color="secondary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" justifyContent="space-between" fontSize="1rem">
                      <span>
                        {network.title}
                        {" - "}
                        <Typography variant="caption" className={classes.version}>
                          {network.version}
                        </Typography>
                      </span>
                      {network.id !== mainnetId && <Chip label="Experimental" size="small" color="secondary" className={classes.experimentalChip} />}
                    </Box>
                  }
                  secondary={network.description}
                />
              </ListItemButton>
            );
          })}
        </List>

        {localSelectedNetworkId !== mainnetId && (
          <Alert variant="outlined" severity="warning" className={classes.alert}>
            <Typography variant="body1">
              <strong>Warning</strong>
            </Typography>

            <Typography variant="body2">Changing networks will restart the app and some features are experimental.</Typography>
          </Alert>
        )}
      </Popup>
  );
};
