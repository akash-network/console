import { Dispatch, ReactNode, SetStateAction } from "react";
import { makeStyles } from "tss-react/mui";
import { Box, Typography } from "@mui/material";
import { Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingCommands: Dispatch<SetStateAction<boolean | number>>;
};

const useStyles = makeStyles()(theme => ({
  editLink: {
    color: theme.palette.secondary.light,
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: "normal",
    fontSize: ".8rem"
  },
  formValue: {
    color: theme.palette.grey[500]
  }
}));

export const CommandList: React.FunctionComponent<Props> = ({ currentService, setIsEditingCommands, serviceIndex }) => {
  const { classes } = useStyles();

  return (
    <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
        <Typography variant="body1">
          <strong>Commands</strong>
        </Typography>

        <CustomTooltip
          arrow
          title={
            <>
              Custom command use when executing container.
              <br />
              <br />
              An example and popular use case is to run a bash script to install packages or run specific commands.
            </>
          }
        >
          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
        </CustomTooltip>

        <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingCommands(serviceIndex !== undefined ? serviceIndex : true)}>
          Edit
        </Box>
      </Box>

      {currentService.command.command.length > 0 ? (
        <Box sx={{ fontSize: ".75rem", whiteSpace: "pre-wrap" }}>
          <div>{currentService.command.command}</div>
          <Box className={classes.formValue}>{currentService.command.arg}</Box>
        </Box>
      ) : (
        <Typography variant="caption" color="darkgray">
          None
        </Typography>
      )}
    </FormPaper>
  );
};
