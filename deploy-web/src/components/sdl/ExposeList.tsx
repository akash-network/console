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
  setIsEditingExpose: Dispatch<SetStateAction<boolean | number>>;
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

export const ExposeList: React.FunctionComponent<Props> = ({ currentService, setIsEditingExpose, serviceIndex }) => {
  const { classes } = useStyles();

  return (
    <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
        <Typography variant="body1">
          <strong>Expose</strong>
        </Typography>

        <CustomTooltip
          arrow
          title={
            <>
              Expose is a list of port settings describing what can connect to the service.
              <br />
              <br />
              <a href="https://docs.akash.network/readme/stack-definition-language#services.expose" target="_blank" rel="noopener">
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
          onClick={() => setIsEditingExpose(serviceIndex !== undefined ? serviceIndex : true)}
        >
          Edit
        </Box>
      </Box>

      {currentService.expose?.map((exp, i) => (
        <Box key={i} sx={{ fontSize: ".75rem", marginBottom: i + 1 === currentService.expose.length ? 0 : ".5rem" }}>
          <div>
            <strong>Port</strong>&nbsp;&nbsp;
            <span className={classes.formValue}>
              {exp.port} : {exp.as} ({exp.proto})
            </span>
          </div>
          <div>
            <strong>Global</strong>&nbsp;&nbsp;
            <span className={classes.formValue}>{exp.global ? "True" : "False"}</span>
          </div>
          {exp.ipName && (
            <div>
              <strong>IP Name</strong>&nbsp;&nbsp;
              <span className={classes.formValue}>{exp.ipName}</span>
            </div>
          )}
          <div>
            <strong>Accept</strong>&nbsp;&nbsp;
            <span className={classes.formValue}>
              {exp.accept?.length > 0
                ? exp.accept?.map((a, i) => (
                    <Box key={i} component="span" sx={{ marginLeft: i === 0 ? 0 : ".5rem" }}>
                      {a.value}
                    </Box>
                  ))
                : "None"}
            </span>
          </div>
        </Box>
      ))}
    </FormPaper>
  );
};
