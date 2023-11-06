import { useTheme } from "@mui/material/styles";
import {
  Box,
  Collapse,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
  useMediaQuery
} from "@mui/material";
import { Controller, Control, UseFormTrigger } from "react-hook-form";
import { makeStyles } from "tss-react/mui";
import { Dispatch, SetStateAction, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import { ExpandMoreButton } from "../shared/ExpandMore";
import { SdlBuilderFormValues, Service } from "@src/types";
import { CommandFormModal } from "./CommandFormModal";
import { EnvFormModal } from "./EnvFormModal";
import { ExposeFormModal } from "./ExposeFormModal";
import { FormPaper } from "./FormPaper";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoIcon from "@mui/icons-material/Info";
import { CustomTooltip } from "../shared/CustomTooltip";
import { PlacementFormModal } from "./PlacementFormModal";
import { udenomToDenom } from "@src/utils/mathHelpers";
import Link from "next/link";
import { PriceValue } from "../shared/PriceValue";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import Image from "next/legacy/image";
import { uAktDenom } from "@src/utils/constants";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { EnvVarList } from "./EnvVarList";
import { CommandList } from "./CommandList";
import { ExposeList } from "./ExposeList";
import { PersistentStorage } from "./PersistentStorage";
import { GpuFormControl } from "./GpuFormControl";
import { CpuFormControl } from "./CpuFormControl";
import { MemoryFormControl } from "./MemoryFormControl";
import { StorageFormControl } from "./StorageFormControl";

type Props = {
  _services: Service[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  trigger: UseFormTrigger<SdlBuilderFormValues>;
  onRemoveService: (index: number) => void;
  serviceCollapsed: number[];
  setServiceCollapsed: Dispatch<SetStateAction<number[]>>;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  },
  serviceBox: {
    marginTop: "1rem",
    border: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]}`,
    borderRadius: ".5rem"
  },
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

export const SimpleServiceFormControl: React.FunctionComponent<Props> = ({
  serviceIndex,
  control,
  _services,
  providerAttributesSchema,
  onRemoveService,
  trigger,
  serviceCollapsed,
  setServiceCollapsed
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [isEditingCommands, setIsEditingCommands] = useState<number>(null);
  const [isEditingEnv, setIsEditingEnv] = useState<number>(null);
  const [isEditingExpose, setIsEditingExpose] = useState<number>(null);
  const [isEditingPlacement, setIsEditingPlacement] = useState<number>(null);
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));
  const expanded = !serviceCollapsed.some(x => x === serviceIndex);
  const currentService: Service = _services[serviceIndex] || ({} as any);
  const _isEditingEnv = serviceIndex === isEditingEnv;
  const _isEditingCommands = serviceIndex === isEditingCommands;
  const _isEditingExpose = serviceIndex === isEditingExpose;
  const _isEditingPlacement = serviceIndex === isEditingPlacement;

  const onExpandClick = () => {
    setServiceCollapsed(prev => {
      if (expanded) {
        return prev.concat([serviceIndex]);
      } else {
        return prev.filter(x => x !== serviceIndex);
      }
    });
  };

  return (
    <Paper className={classes.serviceBox} elevation={2}>
      {/** Edit Environment Variables */}
      <EnvFormModal control={control} onClose={() => setIsEditingEnv(null)} open={_isEditingEnv} serviceIndex={serviceIndex} envs={currentService.env} />
      {/** Edit Commands */}
      <CommandFormModal control={control} onClose={() => setIsEditingCommands(null)} open={_isEditingCommands} serviceIndex={serviceIndex} />
      {/** Edit Expose */}
      <ExposeFormModal
        control={control}
        onClose={() => setIsEditingExpose(null)}
        open={_isEditingExpose}
        serviceIndex={serviceIndex}
        expose={currentService.expose}
        services={_services}
        providerAttributesSchema={providerAttributesSchema}
      />
      {/** Edit Placement */}
      <PlacementFormModal
        control={control}
        onClose={() => setIsEditingPlacement(null)}
        open={_isEditingPlacement}
        serviceIndex={serviceIndex}
        services={_services}
        placement={currentService.placement}
      />

      <Box
        sx={{
          padding: "1rem",
          borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <Controller
          control={control}
          name={`services.${serviceIndex}.title`}
          rules={{
            required: "Service name is required.",
            validate: value => {
              const hasValidChars = /^[a-z0-9\-]+$/.test(value);
              const hasValidStartingChar = /^[a-z]/.test(value);
              const hasValidEndingChar = !value.endsWith("-");

              if (!hasValidChars) {
                return "Invalid service name. It must only be lower case letters, numbers and dashes.";
              } else if (!hasValidStartingChar) {
                return "Invalid starting character. It can only start with a lowercase letter.";
              } else if (!hasValidEndingChar) {
                return "Invalid ending character. It can only end with a lowercase letter or number";
              }

              return true;
            }
          }}
          render={({ field, fieldState }) => (
            <TextField
              type="text"
              variant="outlined"
              label="Service Name"
              color="secondary"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
              value={field.value}
              size="small"
              onChange={event => field.onChange((event.target.value || "").toLowerCase())}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <CustomTooltip
                      arrow
                      title={
                        <>
                          The service name serves as a identifier for the workload to be ran on the Akash Network.
                          <br />
                          <br />
                          <a href="https://docs.akash.network/readme/stack-definition-language#services" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>
                      }
                    >
                      <InfoIcon color="disabled" fontSize="small" />
                    </CustomTooltip>
                  </InputAdornment>
                )
              }}
            />
          )}
        />

        <Box sx={{ marginLeft: "1rem", display: "flex", alignItems: "center" }}>
          {!expanded && isDesktop && (
            <Box sx={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              <LeaseSpecDetail type="cpu" value={currentService.profile.cpu} />
              <LeaseSpecDetail type="ram" sx={{ marginLeft: "1rem" }} value={`${currentService.profile.ram} ${currentService.profile.ramUnit}`} />
              <LeaseSpecDetail type="storage" sx={{ marginLeft: "1rem" }} value={`${currentService.profile.storage} ${currentService.profile.storageUnit}`} />
            </Box>
          )}
          {_services.length > 1 && (
            <IconButton onClick={() => onRemoveService(serviceIndex)} sx={{ marginLeft: ".5rem" }}>
              <DeleteIcon />
            </IconButton>
          )}

          <ExpandMoreButton expand={expanded} onClick={onExpandClick} aria-expanded={expanded} aria-label="show more" sx={{ marginLeft: ".5rem" }}>
            <ExpandMoreIcon />
          </ExpandMoreButton>
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto">
        <Box sx={{ padding: "1rem" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.image`}
                      rules={{
                        required: "Docker image name is required.",
                        validate: value => {
                          const hasValidChars = /^[a-z0-9\-_/:.]+$/.test(value);

                          if (!hasValidChars) {
                            return "Invalid docker image name.";
                          }

                          return true;
                        }
                      }}
                      render={({ field, fieldState }) => (
                        <TextField
                          type="text"
                          variant="outlined"
                          label={`Docker Image / OS`}
                          placeholder="Example: mydockerimage:1.01"
                          color="secondary"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          fullWidth
                          size="small"
                          value={field.value}
                          onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                                  component={Link}
                                  size="small"
                                  target="_blank"
                                >
                                  <OpenInNewIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      )}
                    />

                    <CustomTooltip
                      arrow
                      title={
                        <>
                          Docker image of the container.
                          <br />
                          <br />
                          Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                        </>
                      }
                    >
                      <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: ".5rem" }} />
                    </CustomTooltip>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <CpuFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                </Grid>

                <Grid item xs={12}>
                  <GpuFormControl
                    control={control as any}
                    providerAttributesSchema={providerAttributesSchema}
                    serviceIndex={serviceIndex}
                    hasGpu={currentService.profile.hasGpu}
                    currentService={currentService}
                  />
                </Grid>

                <Grid item xs={12}>
                  <MemoryFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                </Grid>

                <Grid item xs={12}>
                  <StorageFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                </Grid>

                <Grid item xs={12}>
                  <PersistentStorage control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex} />
                </Grid>

                <Grid item xs={12}>
                  <CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} serviceIndex={serviceIndex} />
                </Grid>
              </Grid>

              <Grid item xs={12} sx={{ marginTop: "1rem" }}>
                <ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} serviceIndex={serviceIndex} />
              </Grid>

              <Grid item xs={12} sx={{ marginTop: "1rem" }}>
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.count`}
                  rules={{
                    min: 1,
                    validate: v => {
                      if (!v) return "Service count is required.";
                      return true;
                    }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      type="number"
                      variant="outlined"
                      color="secondary"
                      label="Count"
                      value={field.value || ""}
                      error={!!fieldState.error}
                      onChange={event => {
                        const newValue = parseInt(event.target.value);
                        field.onChange(newValue);

                        if (newValue) {
                          trigger(`services.${serviceIndex}.profile.cpu`);
                          trigger(`services.${serviceIndex}.profile.ram`);
                          trigger(`services.${serviceIndex}.profile.storage`);
                        }
                      }}
                      inputProps={{ min: 1, max: 20, step: 1 }}
                      size="small"
                      fullWidth
                      helperText={!!fieldState.error && fieldState.error.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <CustomTooltip
                              arrow
                              title={
                                <>
                                  The number of instances of the current service. Each instance will have the resources defined in this service.
                                  <br />
                                  <br />
                                  <a href="https://docs.akash.network/readme/stack-definition-language#deployment" target="_blank" rel="noopener">
                                    View official documentation.
                                  </a>
                                </>
                              }
                            >
                              <InfoIcon color="disabled" fontSize="small" />
                            </CustomTooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Grid>
          <Box sx={{ marginTop: "1rem", wordBreak: "break-all" }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
                  <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
                    <Typography variant="body1">
                      <strong>Placement</strong>
                    </Typography>

                    <CustomTooltip
                      arrow
                      title={
                        <>
                          Placement is a list of settings to specify where to host the current service workload.
                          <br />
                          <br />
                          You can filter providers by attributes, audited by and pricing.
                          <br />
                          <br />
                          <a href="https://docs.akash.network/readme/stack-definition-language#profiles.placement" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>
                      }
                    >
                      <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                    </CustomTooltip>

                    <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingPlacement(serviceIndex)}>
                      Edit
                    </Box>
                  </Box>

                  <Box sx={{ fontSize: ".75rem" }}>
                    <div>
                      <strong>Name</strong>&nbsp;&nbsp;
                      <span className={classes.formValue}>{currentService.placement.name}</span>
                    </div>
                    <div>
                      <strong>Pricing</strong>&nbsp;&nbsp;
                      <Box component="span" className={classes.formValue} sx={{ display: "inline-flex", alignItems: "center" }}>
                        Max {udenomToDenom(currentService.placement.pricing.amount, 6)} AKT per block
                        <CustomTooltip
                          arrow
                          title={
                            <>
                              The maximum amount of uAKT you're willing to pay per block (~6 seconds).
                              <br />
                              <br />
                              Akash will only show providers costing <strong>less</strong> than this amount.
                              <br />
                              <br />
                              <div>
                                <strong>
                                  ~
                                  <PriceValue denom={uAktDenom} value={udenomToDenom(getAvgCostPerMonth(currentService.placement.pricing.amount))} />
                                </strong>
                                &nbsp; per month
                              </div>
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="inherit" sx={{ marginLeft: ".5rem" }} />
                        </CustomTooltip>
                      </Box>
                    </div>
                    <div>
                      <strong>Attributes</strong>&nbsp;&nbsp;
                      <span className={classes.formValue}>
                        {currentService.placement.attributes?.length > 0
                          ? currentService.placement.attributes?.map((a, i) => (
                              <Box key={i} component="span" sx={{ fontSize: ".75rem" }}>
                                {a.key}=
                                <Box component="span" className={classes.formValue}>
                                  {a.value}
                                </Box>
                              </Box>
                            ))
                          : "None"}
                      </span>
                    </div>
                    <div>
                      <strong>Signed by any of</strong>&nbsp;&nbsp;
                      <span className={classes.formValue}>
                        {currentService.placement.signedBy?.anyOf?.length > 0
                          ? currentService.placement.signedBy?.anyOf?.map((a, i) => (
                              <Box key={i} component="span" sx={{ marginLeft: i === 0 ? 0 : ".5rem" }}>
                                {a.value}
                              </Box>
                            ))
                          : "None"}
                      </span>
                    </div>
                    <div>
                      <strong>Signed by all of</strong>&nbsp;&nbsp;
                      <span className={classes.formValue}>
                        {currentService.placement.signedBy?.allOf?.length > 0
                          ? currentService.placement.signedBy?.allOf?.map((a, i) => (
                              <Box key={i} component="span" sx={{ marginLeft: i === 0 ? 0 : ".5rem" }}>
                                {a.value}
                              </Box>
                            ))
                          : "None"}
                      </span>
                    </div>
                  </Box>
                </FormPaper>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};
