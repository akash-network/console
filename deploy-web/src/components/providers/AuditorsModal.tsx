import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Tooltip,
  Chip
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useAkashProviders } from "../../context/AkashProvider";
import { Address } from "../shared/Address";
import { CustomTooltip } from "../shared/CustomTooltip";
import { LinkTo } from "../shared/LinkTo";

const useStyles = makeStyles()(theme => ({
  content: {
    padding: "1rem"
  },
  tableHead: {
    fontWeight: "bold"
  },
  tooltip: {
    fontSize: "1rem",
    padding: ".5rem",
    textAlign: "center"
  },
  websiteLink: {
    fontSize: "1rem",
    marginBottom: ".5rem"
  },
  auditorChip: {
    marginBottom: "2px"
  }
}));

export const AuditorsModal = ({ provider, onClose }) => {
  const { classes } = useStyles();
  const { auditors } = useAkashProviders();

  const onWebsiteClick = (event, website) => {
    event.preventDefault();
    event.stopPropagation();

    window.open(website, "_blank");
  };

  return (
    <Dialog maxWidth="md" open={true} onClose={onClose} fullWidth>
      <DialogTitle>Audited Attributes</DialogTitle>
      <DialogContent dividers className={classes.content}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell className={classes.tableHead}>Key</TableCell>
                <TableCell className={classes.tableHead}>Value</TableCell>
                <TableCell className={classes.tableHead}>Auditors</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {provider.attributes.map(a => {
                return (
                  <TableRow key={a.key}>
                    <TableCell component="th" scope="row">
                      {a.key}
                    </TableCell>
                    <TableCell>{a.value}</TableCell>
                    <TableCell>
                      {a.auditedBy
                        .filter(x => auditors.some(y => y.address === x))
                        .map(x => {
                          const auditor = auditors.find(y => y.address === x);
                          return (
                            <div key={x}>
                              <CustomTooltip
                                arrow
                                title={
                                  <div>
                                    <LinkTo onClick={event => onWebsiteClick(event, auditor.website)} className={classes.websiteLink}>
                                      {auditor.website}
                                    </LinkTo>
                                    <Address address={auditor.address} isCopyable />
                                  </div>
                                }
                              >
                                <Chip label={auditor.name} size="small" className={classes.auditorChip} />
                              </CustomTooltip>
                            </div>
                          );
                        })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button autoFocus variant="contained" onClick={onClose} color="secondary" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
