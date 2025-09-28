import type { ReactNode } from "react";
import type { SnackbarKey, VariantType } from "notistack";

export interface SnackbarService {
  enqueueSnackbar: jest.MockedFunction<
    (
      message: ReactNode,
      options?: { variant?: VariantType; autoHideDuration?: number; persist?: boolean; action?: (key: SnackbarKey) => ReactNode }
    ) => SnackbarKey
  >;
  closeSnackbar: jest.MockedFunction<(key?: SnackbarKey) => void>;
}

export const buildSnackbarService = (overrides: Partial<SnackbarService> = {}): SnackbarService => ({
  enqueueSnackbar: jest.fn() as jest.MockedFunction<
    (
      message: ReactNode,
      options?: { variant?: VariantType; autoHideDuration?: number; persist?: boolean; action?: (key: SnackbarKey) => ReactNode }
    ) => SnackbarKey
  >,
  closeSnackbar: jest.fn() as jest.MockedFunction<(key?: SnackbarKey) => void>,
  ...overrides
});
