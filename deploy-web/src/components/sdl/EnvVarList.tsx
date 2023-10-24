import { Dispatch, ReactNode, SetStateAction } from "react";
import { makeStyles } from "tss-react/mui";
import { Control } from "react-hook-form";
import { Box, Typography } from "@mui/material";
import { RentGpusFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  serviceIndex?: number;
  children?: ReactNode;
  setIsEditingEnv: Dispatch<SetStateAction<boolean | number>>;
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

export const EnvVarList: React.FunctionComponent<Props> = ({ currentService, setIsEditingEnv, serviceIndex }) => {
  const { classes } = useStyles();

  return (
    <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
        <Typography variant="body1">
          <strong>Environment Variables</strong>
        </Typography>

        <CustomTooltip
          arrow
          title={
            <>
              A list of environment variables to expose to the running container.
              <br />
              <br />
              <a href="https://docs.akash.network/readme/stack-definition-language#services.env" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>
          }
        >
          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
        </CustomTooltip>

        <Box
          component="span"
          sx={{ marginLeft: "1rem" }}
          className={classes.editLink}
          onClick={() => setIsEditingEnv(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </Box>
      </Box>

      {currentService.env.length > 0 ? (
        currentService.env.map((e, i) => (
          <Box key={i} sx={{ fontSize: ".75rem" }}>
            <div>
              {e.key}=
              <Box component="span" className={classes.formValue}>
                {e.value}
              </Box>
            </div>
          </Box>
        ))
      ) : (
        <Typography variant="caption" color="darkgray">
          None
        </Typography>
      )}
    </FormPaper>
  );
};
