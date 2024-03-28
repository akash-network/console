import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, ClickAwayListener, IconButton, InputAdornment, Paper, Popper, TextField, useTheme } from "@mui/material";
import { ApiTemplate, RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { Control, Controller } from "react-hook-form";
import Image from "next/image";
import Link from "next/link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useGpuTemplates } from "@src/hooks/useGpuTemplates";

type Props = {
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  currentService: Service;
  onSelectTemplate: (template: ApiTemplate) => void;
};

export const ImageSelect: React.FunctionComponent<Props> = ({ control, currentService, onSelectTemplate }) => {
  const theme = useTheme();
  const { gpuTemplates } = useGpuTemplates();
  const [hoveredTemplate, setHoveredTemplate] = useState<ApiTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ApiTemplate | null>(null);
  const [popperWidth, setPopperWidth] = useState<number>(null);
  const eleRefs = useRef(null);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const filteredGpuTemplates = gpuTemplates.filter(x => x.name.toLowerCase().includes(currentService.image));
  const open = Boolean(anchorEl) && filteredGpuTemplates.length > 0;

  useEffect(() => {
    // Populate ref list
    gpuTemplates.forEach(template => (eleRefs[template.id] = { current: null }));
  }, [gpuTemplates]);

  // Effect that scrolls active element when it changes
  useLayoutEffect(() => {
    if (selectedTemplate) {
      eleRefs[selectedTemplate.id].current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
  }, [gpuTemplates, selectedTemplate]);

  useLayoutEffect(() => {
    if (!popperWidth && textFieldRef.current) {
      setPopperWidth(textFieldRef.current?.offsetWidth);
    }
  }, [textFieldRef.current, popperWidth]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setAnchorEl(event.currentTarget);

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();

      if (selectedTemplate) {
        onSelectTemplate(selectedTemplate);
      }

      onClose();
    }

    if (event.key === "ArrowUp") {
      if (hoveredTemplate || selectedTemplate) {
        const index = filteredGpuTemplates.findIndex(x => x.id === hoveredTemplate?.id || x.id === selectedTemplate?.id);
        const newIndex = (index - 1 + filteredGpuTemplates.length) % filteredGpuTemplates.length;

        setSelectedTemplate(filteredGpuTemplates[newIndex]);
      } else {
        setSelectedTemplate(filteredGpuTemplates[filteredGpuTemplates.length - 1]);
      }

      setHoveredTemplate(null);
    }

    if (event.key === "ArrowDown") {
      if (hoveredTemplate || selectedTemplate) {
        const index = filteredGpuTemplates.findIndex(x => x.id === hoveredTemplate?.id || x.id === selectedTemplate?.id);
        const newIndex = (index + 1) % filteredGpuTemplates.length;

        setSelectedTemplate(filteredGpuTemplates[newIndex]);
      } else {
        setSelectedTemplate(filteredGpuTemplates[0]);
      }

      setHoveredTemplate(null);
    }
  };

  const _onSelectTemplate = (template: ApiTemplate) => {
    setAnchorEl(null);

    onSelectTemplate(template);
  };

  const onClose = () => {
    setAnchorEl(null);
    setSelectedTemplate(null);
    setHoveredTemplate(null);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
      <ClickAwayListener onClickAway={onClose}>
        <Box sx={{ width: "100%" }}>
          <Controller
            control={control}
            name={`services.0.image`}
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
                ref={textFieldRef}
                label={`Docker Image / OS`}
                placeholder="Example: mydockerimage:1.01"
                color="secondary"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                fullWidth
                size="small"
                value={field.value}
                onChange={event => field.onChange(event.target.value || "")}
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

          <Popper
            id="test"
            open={open}
            placement="bottom-start"
            anchorEl={anchorEl}
            disablePortal
            sx={{ zIndex: 1000, width: `${popperWidth}px`, boxShadow: theme.shadows[2] }}
            nonce={undefined}
            onResize={undefined}
            onResizeCapture={undefined}
          >
            <Paper>
              <Box
                component="ul"
                sx={{
                  listStyle: "none",
                  margin: 0,
                  padding: "8px 0",
                  maxHeight: "40vh",
                  overflow: "auto",
                  position: "relative"
                }}
              >
                {filteredGpuTemplates.map(template => (
                  <Box
                    component="li"
                    className={"MuiAutocomplete-option"}
                    ref={eleRefs[template.id]}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between !important",
                      width: "100%",
                      padding: ".5rem 1rem",
                      minHeight: "auto",
                      overflow: "hidden",
                      backgroundColor:
                        selectedTemplate?.id === template.id
                          ? theme.palette.mode === "dark"
                            ? theme.palette.grey[700]
                            : theme.palette.grey[300]
                          : hoveredTemplate?.id === template.id
                          ? theme.palette.mode === "dark"
                            ? theme.palette.grey[900]
                            : theme.palette.grey[100]
                          : "transparent",
                      "&:hover": {
                        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
                        cursor: "pointer"
                      }
                    }}
                    key={template.id}
                    onClick={() => _onSelectTemplate(template)}
                    onMouseOver={() => {
                      setHoveredTemplate(template);
                      setSelectedTemplate(null);
                    }}
                  >
                    <div>{template.name}</div>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Popper>
        </Box>
      </ClickAwayListener>

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
  );
};
