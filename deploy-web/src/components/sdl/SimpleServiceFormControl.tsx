import { useTheme } from "@mui/material/styles";
import {
  Box,
  Checkbox,
  Collapse,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Typography,
  useMediaQuery
} from "@mui/material";
import { Controller, Control, UseFormTrigger } from "react-hook-form";
import { cx } from "@emotion/css";
import { makeStyles } from "tss-react/mui";
import { Dispatch, SetStateAction, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import { ExpandMore } from "../shared/ExpandMore";
import { SdlBuilderFormValues, Service } from "@src/types";
import { CommandFormModal } from "./CommandFormModal";
import { EnvFormModal } from "./EnvFormModal";
import { ExposeFormModal } from "./ExposeFormModal";
import { maxGroupMemory, maxMemory, maxStorage, minMemory, minStorage, persistentStorageTypes, memoryUnits, storageUnits } from "../shared/akash/units";
import { FormPaper } from "./FormPaper";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoIcon from "@mui/icons-material/Info";
import { CustomTooltip } from "../shared/CustomTooltip";
import { PlacementFormModal } from "./PlacementFormModal";
import { udenomToDenom } from "@src/utils/mathHelpers";
import Link from "next/link";
import { PriceValue } from "../shared/PriceValue";
import { averageBlockTime } from "@src/utils/priceUtils";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import Image from "next/legacy/image";
import { uAktDenom } from "@src/utils/constants";
import { gpuVendors } from "../shared/akash/gpu";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { FormSelect } from "./FormSelect";

type Props = {
  service: Service;
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
  service,
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

          <ExpandMore expand={expanded} onClick={onExpandClick} aria-expanded={expanded} aria-label="show more" sx={{ marginLeft: ".5rem" }}>
            <ExpandMoreIcon />
          </ExpandMore>
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
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.cpu`}
                    rules={{
                      validate: v => {
                        if (!v) return "CPU amount is required.";

                        const _value = v || 0;

                        if (currentService.count === 1 && _value < 0.1) {
                          return "Minimum amount of CPU for a single service instance is 0.1.";
                        } else if (currentService.count === 1 && _value > 256) {
                          return "Maximum amount of CPU for a single service instance is 256.";
                        } else if (currentService.count > 1 && currentService.count * _value > 512) {
                          return "Maximum total amount of CPU for a single service instance group is 512.";
                        }

                        return true;
                      }
                    }}
                    render={({ field, fieldState }) => (
                      <FormPaper elevation={1} sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}` }}>
                        <FormControl
                          className={cx(classes.formControl, classes.textField)}
                          variant="standard"
                          sx={{ marginBottom: "0 !important" }}
                          error={!!fieldState.error}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: { xs: "flex-start", sm: "center" },
                              justifyContent: "space-between",
                              flexDirection: { xs: "column", sm: "row" }
                            }}
                          >
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                              <SpeedIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                              <strong>CPU</strong>

                              <CustomTooltip
                                arrow
                                title={
                                  <>
                                    The amount of vCPU's required for this workload.
                                    <br />
                                    <br />
                                    The maximum for a single instance is 256 vCPU's.
                                    <br />
                                    <br />
                                    The maximum total multiplied by the count of instances is 512 vCPU's.
                                  </>
                                }
                              >
                                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                              </CustomTooltip>
                            </Typography>

                            <TextField
                              type="number"
                              variant="outlined"
                              color="secondary"
                              error={!!fieldState.error}
                              value={field.value || ""}
                              onChange={event => field.onChange(parseFloat(event.target.value))}
                              inputProps={{ min: 0.1, max: 256, step: 0.1 }}
                              size="small"
                              sx={{ width: "100px", marginTop: { xs: ".5rem", sm: 0 } }}
                            />
                          </Box>

                          <Slider
                            value={field.value || 0}
                            min={0.1}
                            max={256}
                            step={1}
                            color="secondary"
                            aria-label="CPU"
                            valueLabelDisplay="auto"
                            onChange={(event, newValue) => field.onChange(newValue)}
                          />

                          {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      </FormPaper>
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormPaper elevation={1} sx={{ padding: currentService.profile.hasGpu ? ".5rem 1rem 1rem" : ".5rem 1rem" }}>
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.profile.gpu`}
                      rules={{
                        validate: v => {
                          if (!v) return "GPU amount is required.";
                          else if (v < 1) return "GPU amount must be greater than 0.";
                          return true;
                        }
                      }}
                      render={({ field, fieldState }) => (
                        <FormControl
                          className={cx(classes.formControl, classes.textField)}
                          variant="standard"
                          sx={{ marginBottom: "0 !important" }}
                          error={!!fieldState.error}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: { xs: "flex-start", sm: "center" },
                              justifyContent: "space-between",
                              flexDirection: { xs: "column", sm: "row" }
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                                <SpeedIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                                <strong>GPU</strong>

                                <CustomTooltip
                                  arrow
                                  title={
                                    <>
                                      The amount of GPUs required for this workload.
                                      <br />
                                      <br />
                                      You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any
                                      GPU model will bid on your workload.
                                      <br />
                                      <br />
                                      <a href="https://docs.akash.network/testnet/example-gpu-sdls/specific-gpu-vendor" target="_blank" rel="noopener">
                                        View official documentation.
                                      </a>
                                    </>
                                  }
                                >
                                  <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                                </CustomTooltip>
                              </Typography>

                              <Controller
                                control={control}
                                name={`services.${serviceIndex}.profile.hasGpu`}
                                render={({ field }) => (
                                  <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />
                                )}
                              />
                            </Box>

                            {currentService.profile.hasGpu && (
                              <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                                <TextField
                                  type="number"
                                  variant="outlined"
                                  color="secondary"
                                  value={field.value || ""}
                                  error={!!fieldState.error}
                                  onChange={event => field.onChange(parseFloat(event.target.value))}
                                  inputProps={{ min: 1, step: 1 }}
                                  size="small"
                                  sx={{ width: "100px" }}
                                />
                              </Box>
                            )}
                          </Box>

                          {currentService.profile.hasGpu && (
                            <Slider
                              value={field.value || 0}
                              min={1}
                              max={100}
                              step={1}
                              color="secondary"
                              aria-label="GPUs"
                              valueLabelDisplay="auto"
                              onChange={(event, newValue) => field.onChange(newValue)}
                            />
                          )}

                          {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      )}
                    />

                    {currentService.profile.hasGpu && (
                      <div>
                        <Box sx={{ marginTop: "1rem" }}>
                          <Controller
                            control={control}
                            name={`services.${serviceIndex}.profile.gpuVendor`}
                            rules={{ required: "GPU vendor is required." }}
                            defaultValue=""
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onChange={field.onChange}
                                variant="outlined"
                                fullWidth
                                size="small"
                                MenuProps={{ disableScrollLock: true }}
                              >
                                {gpuVendors.map(u => (
                                  <MenuItem key={u.id} value={u.value}>
                                    {u.value}
                                  </MenuItem>
                                ))}
                              </Select>
                            )}
                          />
                        </Box>

                        <Box sx={{ marginTop: "1rem" }}>
                          <FormSelect
                            control={control}
                            label="GPU models"
                            optionName="hardware-gpu-model"
                            name={`services.${serviceIndex}.profile.gpuModels`}
                            providerAttributesSchema={providerAttributesSchema}
                            required={false}
                            multiple
                          />
                        </Box>
                      </div>
                    )}
                  </FormPaper>
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.ram`}
                    rules={{
                      validate: v => {
                        if (!v) return "Memory amount is required.";

                        const currentUnit = memoryUnits.find(u => currentService.profile.ramUnit === u.suffix);
                        const _value = (v || 0) * currentUnit.value;

                        if (currentService.count === 1 && _value < minMemory) {
                          return "Minimum amount of memory for a single service instance is 1 Mi.";
                        } else if (currentService.count === 1 && currentService.count * _value > maxMemory) {
                          return "Maximum amount of memory for a single service instance is 512 Gi.";
                        } else if (currentService.count > 1 && currentService.count * _value > maxGroupMemory) {
                          return "Maximum total amount of memory for a single service instance group is 1024 Gi.";
                        }

                        return true;
                      }
                    }}
                    render={({ field, fieldState }) => (
                      <FormPaper elevation={1} sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}` }}>
                        <FormControl
                          className={cx(classes.formControl, classes.textField)}
                          variant="standard"
                          sx={{ marginBottom: "0 !important" }}
                          error={!!fieldState.error}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: { xs: "flex-start", sm: "center" },
                              justifyContent: "space-between",
                              flexDirection: { xs: "column", sm: "row" }
                            }}
                          >
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                              <MemoryIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                              <strong>Memory</strong>

                              <CustomTooltip
                                arrow
                                title={
                                  <>
                                    The amount of memory required for this workload.
                                    <br />
                                    <br />
                                    The maximum for a single instance is 512 Gi.
                                    <br />
                                    <br />
                                    The maximum total multiplied by the count of instances is 1024 Gi.
                                  </>
                                }
                              >
                                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                              </CustomTooltip>
                            </Typography>

                            <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                              <TextField
                                type="number"
                                variant="outlined"
                                error={!!fieldState.error}
                                color="secondary"
                                value={field.value || ""}
                                onChange={event => field.onChange(parseFloat(event.target.value))}
                                inputProps={{ min: 1, step: 1 }}
                                size="small"
                                sx={{ width: "100px" }}
                              />

                              <Controller
                                control={control}
                                name={`services.${serviceIndex}.profile.ramUnit`}
                                rules={{ required: "Ram unit is required." }}
                                defaultValue=""
                                render={({ field }) => (
                                  <Select
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    variant="outlined"
                                    size="small"
                                    sx={{ width: "75px", marginLeft: ".25rem" }}
                                    MenuProps={{ disableScrollLock: true }}
                                  >
                                    {memoryUnits.map(u => (
                                      <MenuItem key={u.id} value={u.suffix}>
                                        {u.suffix}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                )}
                              />
                            </Box>
                          </Box>

                          <Slider
                            value={field.value || 0}
                            min={1}
                            max={512}
                            step={1}
                            color="secondary"
                            aria-label="RAM"
                            valueLabelDisplay="auto"
                            onChange={(event, newValue) => field.onChange(newValue)}
                          />

                          {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      </FormPaper>
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    control={control}
                    rules={{
                      validate: v => {
                        if (!v) return "Storage amount is required.";

                        const currentUnit = storageUnits.find(u => currentService.profile.storageUnit === u.suffix);
                        const _value = (v || 0) * currentUnit.value;

                        if (currentService.count * _value < minStorage) {
                          return "Minimum amount of storage for a single service instance is 5 Mi.";
                        } else if (currentService.count * _value > maxStorage) {
                          return "Maximum amount of storage for a single service instance is 32 Ti.";
                        }

                        return true;
                      }
                    }}
                    name={`services.${serviceIndex}.profile.storage`}
                    render={({ field, fieldState }) => (
                      <FormPaper elevation={1} sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}` }}>
                        <FormControl
                          className={cx(classes.formControl, classes.textField)}
                          variant="standard"
                          sx={{ marginBottom: "0 !important" }}
                          error={!!fieldState.error}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: { xs: "flex-start", sm: "center" },
                              justifyContent: "space-between",
                              flexDirection: { xs: "column", sm: "row" }
                            }}
                          >
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                              <StorageIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                              <strong>Ephemeral Storage</strong>

                              <CustomTooltip
                                arrow
                                title={
                                  <>
                                    The amount of ephemeral disk storage required for this workload.
                                    <br />
                                    <br />
                                    This disk storage is ephemeral, meaning it will be wiped out on every deployment update or provider reboot.
                                    <br />
                                    <br />
                                    The maximum for a single instance is 32 Ti.
                                    <br />
                                    <br />
                                    The maximum total multiplied by the count of instances is also 32 Ti.
                                  </>
                                }
                              >
                                <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                              </CustomTooltip>
                            </Typography>

                            <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                              <TextField
                                type="number"
                                variant="outlined"
                                color="secondary"
                                value={field.value || ""}
                                error={!!fieldState.error}
                                onChange={event => field.onChange(parseFloat(event.target.value))}
                                inputProps={{ min: 1, step: 1 }}
                                size="small"
                                sx={{ width: "100px" }}
                              />

                              <Controller
                                control={control}
                                name={`services.${serviceIndex}.profile.storageUnit`}
                                rules={{ required: "Storage unit is required." }}
                                defaultValue=""
                                render={({ field }) => (
                                  <Select
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    variant="outlined"
                                    size="small"
                                    sx={{ width: "75px", marginLeft: ".25rem" }}
                                    MenuProps={{ disableScrollLock: true }}
                                  >
                                    {storageUnits.map(u => (
                                      <MenuItem key={u.id} value={u.suffix}>
                                        {u.suffix}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                )}
                              />
                            </Box>
                          </Box>

                          <Slider
                            value={field.value || 0}
                            min={1}
                            max={512}
                            step={1}
                            color="secondary"
                            aria-label="Storage"
                            valueLabelDisplay="auto"
                            onChange={(event, newValue) => field.onChange(newValue)}
                          />

                          {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      </FormPaper>
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormPaper elevation={1} sx={{ padding: currentService.profile.hasPersistentStorage ? ".5rem 1rem 1rem" : ".5rem 1rem" }}>
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.profile.persistentStorage`}
                      rules={{
                        min: 1,
                        validate: v => {
                          if (!v) return "Storage amount is required.";
                          return true;
                        }
                      }}
                      render={({ field, fieldState }) => (
                        <FormControl
                          className={cx(classes.formControl, classes.textField)}
                          variant="standard"
                          sx={{ marginBottom: "0 !important" }}
                          error={!!fieldState.error}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: { xs: "flex-start", sm: "center" },
                              justifyContent: "space-between",
                              flexDirection: { xs: "column", sm: "row" }
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                                <StorageIcon sx={{ color: theme.palette.grey[600], marginRight: ".5rem" }} fontSize="medium" />
                                <strong>Persistent Storage</strong>

                                <CustomTooltip
                                  arrow
                                  title={
                                    <>
                                      The amount of persistent storage required for this workload.
                                      <br />
                                      <br />
                                      This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
                                      <br />
                                      <br />
                                      <a href="https://docs.akash.network/features/persistent-storage" target="_blank" rel="noopener">
                                        View official documentation.
                                      </a>
                                    </>
                                  }
                                >
                                  <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                                </CustomTooltip>
                              </Typography>

                              <Controller
                                control={control}
                                name={`services.${serviceIndex}.profile.hasPersistentStorage`}
                                render={({ field }) => (
                                  <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />
                                )}
                              />
                            </Box>

                            {currentService.profile.hasPersistentStorage && (
                              <Box sx={{ marginTop: { xs: ".5rem", sm: 0 } }}>
                                <TextField
                                  type="number"
                                  variant="outlined"
                                  color="secondary"
                                  value={field.value || ""}
                                  error={!!fieldState.error}
                                  onChange={event => field.onChange(parseFloat(event.target.value))}
                                  inputProps={{ min: 1, step: 1 }}
                                  size="small"
                                  sx={{ width: "100px" }}
                                />

                                <Controller
                                  control={control}
                                  name={`services.${serviceIndex}.profile.persistentStorageUnit`}
                                  rules={{ required: "Storage unit is required." }}
                                  defaultValue=""
                                  render={({ field }) => (
                                    <Select
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      variant="outlined"
                                      size="small"
                                      sx={{ width: "75px", marginLeft: ".25rem" }}
                                      MenuProps={{ disableScrollLock: true }}
                                    >
                                      {storageUnits.map(u => (
                                        <MenuItem key={u.id} value={u.suffix}>
                                          {u.suffix}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  )}
                                />
                              </Box>
                            )}
                          </Box>

                          {currentService.profile.hasPersistentStorage && (
                            <Slider
                              value={field.value || 0}
                              min={1}
                              max={512}
                              step={1}
                              color="secondary"
                              aria-label="Persistent Storage"
                              valueLabelDisplay="auto"
                              onChange={(event, newValue) => field.onChange(newValue)}
                            />
                          )}

                          {!!fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                        </FormControl>
                      )}
                    />

                    {currentService.profile.hasPersistentStorage && (
                      <div>
                        <Box sx={{ display: "flex", alignItems: "flex-start", marginTop: "1rem" }}>
                          <Controller
                            control={control}
                            name={`services.${serviceIndex}.profile.persistentStorageParam.name`}
                            rules={{
                              required: "Name is required.",
                              validate: value => {
                                const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                                const hasValidStartingChar = /^[a-z]/.test(value);
                                const hasValidEndingChar = !value.endsWith("-");

                                if (!hasValidChars) {
                                  return "Invalid storage name. It must only be lower case letters, numbers and dashes.";
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
                                color="secondary"
                                label="Name"
                                value={field.value}
                                error={!!fieldState.error}
                                onChange={event => field.onChange(event.target.value)}
                                size="small"
                                sx={{ width: "100%" }}
                                helperText={!!fieldState.error && fieldState.error.message}
                                InputProps={{
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      <CustomTooltip
                                        arrow
                                        title={
                                          <>
                                            The name of the persistent volume.
                                            <br />
                                            <br />
                                            Multiple services can gain access to the same volume by name.
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
                          <Box sx={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
                            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                              <strong>Read only</strong>
                            </Typography>

                            <Controller
                              control={control}
                              name={`services.${serviceIndex}.profile.persistentStorageParam.readOnly`}
                              render={({ field }) => (
                                <Checkbox checked={field.value} onChange={field.onChange} color="secondary" size="small" sx={{ marginLeft: ".5rem" }} />
                              )}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "flex-start", marginTop: "1rem" }}>
                          <Controller
                            control={control}
                            name={`services.${serviceIndex}.profile.persistentStorageParam.type`}
                            render={({ field }) => (
                              <FormControl fullWidth sx={{ flexBasis: "40%" }}>
                                <InputLabel id={`persistent-storage-type-${service.id}`}>Type</InputLabel>
                                <Select
                                  labelId={`persistent-storage-type-${service.id}`}
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  variant="outlined"
                                  size="small"
                                  sx={{ width: "100%" }}
                                  label="Type"
                                  MenuProps={{ disableScrollLock: true }}
                                >
                                  {persistentStorageTypes.map(u => (
                                    <MenuItem key={u.id} value={u.className}>
                                      {u.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`services.${serviceIndex}.profile.persistentStorageParam.mount`}
                            rules={{ required: "Mount is required.", pattern: { value: /^\/.*$/, message: "Mount must be an absolute path." } }}
                            render={({ field, fieldState }) => (
                              <TextField
                                type="text"
                                variant="outlined"
                                color="secondary"
                                label="Mount"
                                placeholder="Example: /mnt/data"
                                value={field.value}
                                error={!!fieldState.error}
                                onChange={event => field.onChange(event.target.value)}
                                size="small"
                                sx={{ width: "100%", marginLeft: ".5rem" }}
                                helperText={!!fieldState.error && fieldState.error.message}
                                InputProps={{
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      <CustomTooltip
                                        arrow
                                        title={
                                          <>
                                            The path to mount the persistent volume to.
                                            <br />
                                            <br />
                                            Example: /mnt/data
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
                        </Box>
                      </div>
                    )}
                  </FormPaper>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
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

                      <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingEnv(serviceIndex)}>
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
                </Grid>

                <Grid item xs={12}>
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

                      <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingCommands(serviceIndex)}>
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
                </Grid>
              </Grid>

              <Grid item xs={12} sx={{ marginTop: "1rem" }}>
                <FormPaper elevation={1} sx={{ padding: ".5rem 1rem" }}>
                  <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
                    <Typography variant="body1">
                      <strong>Expose</strong>
                    </Typography>

                    <CustomTooltip
                      arrow
                      title={
                        <>
                          Expose is a list of settings describing what can connect to the service.
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

                    <Box component="span" sx={{ marginLeft: "1rem" }} className={classes.editLink} onClick={() => setIsEditingExpose(serviceIndex)}>
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
                                  <PriceValue
                                    denom={uAktDenom}
                                    value={udenomToDenom(currentService.placement.pricing.amount) * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth}
                                  />
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
