import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

const useStyles = makeStyles()(theme => ({
  list: {},
  dialogContent: {
    padding: "0 .5rem"
  },
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
  },
  dialogActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
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
    <Dialog open={true} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Select Network</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        <List className={classes.list}>
          {networks.map(network => {
            return (
              <ListItemButton
                key={network.id}
                dense
                onClick={() => handleSelectNetwork(network)}
                disabled={!network.enabled}
              >
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
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={onClose} type="button" autoFocus>
          Close
        </Button>
        <Button variant="contained" onClick={handleSaveChanges} color="secondary" type="button">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};