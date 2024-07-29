"use client";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Control, Controller } from "react-hook-form";
import { buttonVariants, CustomTooltip } from "@akashnetwork/ui/components";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import InputAdornment from "@mui/material/InputAdornment";
import Popper from "@mui/material/Popper";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import { InfoCircle, OpenNewWindow } from "iconoir-react";
import Image from "next/image";
import Link from "next/link";

import { useGpuTemplates } from "@src/hooks/useGpuTemplates";
import { ApiTemplate, RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { cn } from "@src/utils/styleUtils";

type Props = {
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  currentService: ServiceType;
  onSelectTemplate: (template: ApiTemplate) => void;
};

export const ImageSelect: React.FunctionComponent<Props> = ({ control, currentService, onSelectTemplate }) => {
  const muiTheme = useMuiTheme();
  const { gpuTemplates } = useGpuTemplates();
  const [hoveredTemplate, setHoveredTemplate] = useState<ApiTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ApiTemplate | null>(null);
  const [popperWidth, setPopperWidth] = useState<number | null>(null);
  const eleRefs = useRef(null);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const filteredGpuTemplates = gpuTemplates.filter(x => x.name?.toLowerCase().includes(currentService.image));
  const open = Boolean(anchorEl) && filteredGpuTemplates.length > 0;

  useEffect(() => {
    // Populate ref list
    gpuTemplates.forEach(template => (eleRefs[template.id as string] = { current: null }));
  }, [gpuTemplates]);

  // Effect that scrolls active element when it changes
  useLayoutEffect(() => {
    if (selectedTemplate) {
      eleRefs[selectedTemplate.id as string].current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
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
    <div className="flex w-full items-center">
      <ClickAwayListener onClickAway={onClose}>
        <div className="w-full">
          <Controller
            control={control}
            name={`services.0.image`}
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
                      <Link
                        className={cn(buttonVariants({ variant: "text", size: "icon" }))}
                        href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                        target="_blank"
                      >
                        <OpenNewWindow className="text-xs" />
                      </Link>
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
            sx={{ zIndex: 1000, width: `${popperWidth}px`, boxShadow: muiTheme.shadows[2] }}
            className="bg-popover"
            nonce={undefined}
            onResize={undefined}
            onResizeCapture={undefined}
          >
            <ul className="relative m-0 max-h-[40vh] list-none overflow-auto py-2">
              {filteredGpuTemplates.map(template => (
                <li
                  className="MuiAutocomplete-option flex w-full cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  ref={eleRefs[template.id as string]}
                  key={template.id}
                  onClick={() => _onSelectTemplate(template)}
                  onMouseOver={() => {
                    setHoveredTemplate(template);
                    setSelectedTemplate(null);
                  }}
                >
                  {template.name}
                </li>
              ))}
            </ul>
          </Popper>
        </div>
      </ClickAwayListener>

      <CustomTooltip
        title={
          <>
            Docker image of the container.
            <br />
            <br />
            Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
          </>
        }
      >
        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
      </CustomTooltip>
    </div>
  );
};
