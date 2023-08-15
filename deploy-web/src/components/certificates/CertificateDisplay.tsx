import { useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WarningIcon from "@mui/icons-material/Warning";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CreateIcon from "@mui/icons-material/Create";
import GetAppIcon from "@mui/icons-material/GetApp";
import { useCertificate } from "../../context/CertificateProvider";
import { ExportCertificate } from "./ExportCertificate";
import { makeStyles } from "tss-react/mui";
import { Box, Button, CircularProgress, IconButton, Menu, Paper, Tooltip, Typography, useTheme } from "@mui/material";
import { CustomMenuItem } from "../shared/CustomMenuItem";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import CheckIcon from "@mui/icons-material/Check";

const useStyles = makeStyles()({
  warningIcon: {
    marginLeft: ".5rem"
  },
  tooltip: {
    fontSize: "1rem"
  }
});

export function CertificateDisplay() {
  const [isExportingCert, setIsExportingCert] = useState(false);
  const {
    selectedCertificate,
    isLocalCertMatching,
    isLoadingCertificates,
    loadValidCertificates,
    localCert,
    createCertificate,
    isCreatingCert,
    regenerateCertificate,
    revokeCertificate
  } = useCertificate();
  const { classes } = useStyles();
  const { address } = useKeplr();
  const [anchorEl, setAnchorEl] = useState(null);
  const theme = useTheme();

  function handleMenuClick(ev) {
    setAnchorEl(ev.currentTarget);
  }

  const handleClose = () => {
    setAnchorEl(null);
  };

  const onRegenerateCert = () => {
    handleClose();

    regenerateCertificate();
  };

  const onRevokeCert = () => {
    handleClose();

    revokeCertificate(selectedCertificate);
  };

  return (
    <>
      {address && (
        <Paper
          sx={{
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            padding: ".2rem 1rem",
            backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body2" color="textSecondary">
              {selectedCertificate ? (
                <span>
                  Current certificate:{" "}
                  <Box component="span" sx={{ color: theme.palette.secondary.main, display: "inline-flex", alignItems: "center" }}>
                    {selectedCertificate.serial} <CheckIcon color="secondary" sx={{ marginLeft: ".5rem" }} fontSize="small" />
                  </Box>
                </span>
              ) : (
                "No local certificate."
              )}
            </Typography>

            {selectedCertificate && !isLocalCertMatching && (
              <Tooltip
                classes={{ tooltip: classes.tooltip }}
                arrow
                title="The local certificate doesn't match the one on the blockchain. You can revoke it and create a new one."
              >
                <WarningIcon fontSize="small" color="error" className={classes.warningIcon} />
              </Tooltip>
            )}
          </Box>

          {!isLoadingCertificates && !selectedCertificate && (
            <Box marginLeft="1rem">
              <Button variant="contained" color="secondary" size="small" disabled={isCreatingCert} onClick={() => createCertificate()}>
                {isCreatingCert ? <CircularProgress size="1.5rem" color="secondary" /> : "Create Certificate"}
              </Button>
            </Box>
          )}

          <IconButton
            onClick={() => loadValidCertificates(true)}
            aria-label="refresh"
            disabled={isLoadingCertificates}
            size="small"
            sx={{ marginLeft: "1rem" }}
          >
            {isLoadingCertificates ? <CircularProgress size="1.5rem" color="secondary" /> : <RefreshIcon />}
          </IconButton>

          {selectedCertificate && (
            <Box marginLeft=".5rem">
              <IconButton aria-label="settings" aria-haspopup="true" onClick={handleMenuClick} size="small">
                <MoreHorizIcon />
              </IconButton>
            </Box>
          )}
        </Paper>
      )}

      {selectedCertificate && (
        <Menu
          id="cert-menu"
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right"
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right"
          }}
          onClick={handleClose}
        >
          {/** If local, regenerate else create */}
          {selectedCertificate.parsed === localCert?.certPem ? (
            <CustomMenuItem onClick={() => onRegenerateCert()} icon={<AutorenewIcon fontSize="small" />} text="Regenerate" />
          ) : (
            <CustomMenuItem onClick={() => createCertificate()} icon={<CreateIcon fontSize="small" />} text="Create" />
          )}

          <CustomMenuItem onClick={() => onRevokeCert()} icon={<DeleteForeverIcon fontSize="small" />} text="Revoke" />
          <CustomMenuItem onClick={() => setIsExportingCert(true)} icon={<GetAppIcon fontSize="small" />} text="Export" />
        </Menu>
      )}

      {isExportingCert && <ExportCertificate isOpen={isExportingCert} onClose={() => setIsExportingCert(false)} />}
    </>
  );
}
