export interface SnackbarService {
  enqueueSnackbar: (message: any, options?: any) => string | number;
  closeSnackbar: (key?: string | number) => void;
}

export const buildSnackbarService = (overrides: Partial<SnackbarService> = {}): SnackbarService => ({
  enqueueSnackbar: jest.fn(),
  closeSnackbar: jest.fn(),
  ...overrides
});
