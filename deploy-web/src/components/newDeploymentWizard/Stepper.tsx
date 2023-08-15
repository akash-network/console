import * as React from "react";
import PropTypes from "prop-types";
import { Stepper, Step, StepLabel, StepConnector, stepConnectorClasses, styled } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import CheckIcon from "@mui/icons-material/Check";
import { cx } from "@emotion/css";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { RouteStepKeys } from "@src/utils/constants";

const QontoConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
    left: "calc(-50% + 16px)",
    right: "calc(50% + 16px)"
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.secondary.main
    }
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.secondary.main
    }
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[400],
    borderTopWidth: 3,
    borderRadius: 1
  }
}));

const useQontoStepIconStyles = makeStyles()(theme => ({
  root: {
    color: "#eaeaf0",
    display: "flex",
    height: 22,
    alignItems: "center"
  },
  active: {
    color: theme.palette.secondary.main
  },
  circle: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[400]
  },
  activeCircle: {
    backgroundColor: theme.palette.secondary.main
  },
  completed: {
    color: theme.palette.secondary.main,
    zIndex: 1,
    fontSize: 18
  }
}));

function QontoStepIcon(props) {
  const { classes } = useQontoStepIconStyles();
  const { active, completed } = props;

  return (
    <div
      className={cx(classes.root, {
        [classes.active]: active
      })}
    >
      {completed ? <CheckIcon className={classes.completed} /> : <div className={cx(classes.circle, { [classes.activeCircle]: active })} />}
    </div>
  );
}

QontoStepIcon.propTypes = {
  /**
   * Whether this step is active.
   */
  active: PropTypes.bool,
  /**
   * Mark the step as completed. Is passed to child components.
   */
  completed: PropTypes.bool
};

const useStyles = makeStyles()(theme => ({
  root: {
    padding: "1rem 0",
    flex: 1
  },
  label: {
    "&&": {
      fontWeight: "normal",
      marginTop: "0"
    }
  },
  labelCompleted: {
    "&&": {
      color: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.text.secondary
    }
  },
  labelActive: {
    "&&": {
      fontWeight: "bold",
      color: theme.palette.secondary.main
    }
  }
}));

export const CustomizedSteppers = ({ steps, activeStep }) => {
  const { classes } = useStyles();
  const router = useRouter();

  function onChooseTemplateClick(ev) {
    ev.preventDefault();
    router.replace(UrlService.newDeployment({ step: RouteStepKeys.chooseTemplate }));
  }

  return (
    <Stepper alternativeLabel activeStep={activeStep} connector={<QontoConnector />} classes={{ root: classes.root }}>
      {steps.map(label => (
        <Step key={label}>
          {label === "Choose Template" && activeStep === 2 ? (
            <a href="#" onClick={onChooseTemplateClick}>
              <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: classes.label, completed: classes.labelCompleted, active: classes.labelActive }}>
                {label}
              </StepLabel>
            </a>
          ) : (
            <StepLabel StepIconComponent={QontoStepIcon} classes={{ label: classes.label, completed: classes.labelCompleted, active: classes.labelActive }}>
              {label}
            </StepLabel>
          )}
        </Step>
      ))}
    </Stepper>
  );
};
