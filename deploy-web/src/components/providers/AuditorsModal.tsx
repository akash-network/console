import { Table, TableContainer, TableBody, TableCell, TableRow, TableHead, Chip } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { Address } from "../shared/Address";
import { CustomTooltip } from "../shared/CustomTooltip";
import { LinkTo } from "../shared/LinkTo";
import { Popup } from "../shared/Popup";
import { MouseEventHandler } from "react";
import { useAuditors } from "@src/queries/useProvidersQuery";

const useStyles = makeStyles()(theme => ({
  content: {
    padding: "1rem"
  },
  tableHead: {
    fontWeight: "bold"
  },
  websiteLink: {
    fontSize: "1rem",
    marginBottom: ".5rem"
  },
  auditorChip: {
    marginBottom: "2px"
  }
}));

type Props = {
  attributes: Array<{ key: string; value: string; auditedBy: Array<string> }>;
  onClose: MouseEventHandler<HTMLButtonElement>;
};

export const AuditorsModal: React.FunctionComponent<Props> = ({ attributes, onClose }) => {
  const { classes } = useStyles();
  const { data: auditors } = useAuditors();

  const onWebsiteClick = (event, website) => {
    event.preventDefault();
    event.stopPropagation();

    window.open(website, "_blank");
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Audited Attributes"
      actions={[
        {
          label: "Close",
          color: "secondary",
          variant: "text",
          side: "left",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
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
            {attributes.map(a => {
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
    </Popup>
  );
};
