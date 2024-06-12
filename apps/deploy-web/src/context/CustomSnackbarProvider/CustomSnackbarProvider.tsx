"use client";
import React, { useRef } from "react";
import { styled } from "@mui/material/styles";
import { Xmark } from "iconoir-react";
import { MaterialDesignContent, SnackbarKey, SnackbarProvider } from "notistack";

import { Button } from "@akashnetwork/ui/components";
import useTailwind from "@src/hooks/useTailwind";

const StyledMaterialDesignContent = styled(MaterialDesignContent)(() => {
  const tw = useTailwind();
  return {
    "&.notistack-MuiContent-success": {
      backgroundColor: tw.theme.colors.green[600]
    },
    "&.notistack-MuiContent-error": {
      backgroundColor: "hsl(var(--destructive))"
    },
    "&.notistack-MuiContent-warning": {
      backgroundColor: "hsl(var(--warning))"
    },
    "&.notistack-MuiContent-info": {
      backgroundColor: tw.theme.colors.blue[600]
    }
  };
});

export const CustomSnackbarProvider = ({ children }) => {
  const notistackRef = useRef<SnackbarProvider>(null);
  const onClickDismiss = (key: SnackbarKey) => () => {
    notistackRef.current?.closeSnackbar(key);
  };

  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      ref={notistackRef}
      classes={{
        containerRoot: "pb-4 !w-[360px] [&>div]:w-full"
      }}
      Components={{
        success: StyledMaterialDesignContent,
        error: StyledMaterialDesignContent,
        warning: StyledMaterialDesignContent,
        info: StyledMaterialDesignContent
      }}
      hideIconVariant
      dense
      action={key => (
        <div className="w-8">
          <Button
            onClick={onClickDismiss(key)}
            size="icon"
            variant="text"
            className="absolute right-2 top-2 h-6 w-6 rounded-full text-white hover:text-white/70"
          >
            <Xmark className="text-xs" />
          </Button>
        </div>
      )}
    >
      {children}
    </SnackbarProvider>
  );
};
