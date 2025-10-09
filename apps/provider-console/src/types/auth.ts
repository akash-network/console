export type AuthMode = "wallet" | "akash-at-home";
export type UserType = "provider" | "akash-at-home-user";

export interface AuthContextType {
  authMode: AuthMode;
  userType: UserType;
  isAuthenticated: boolean;
  canSwitchModes: boolean;
  switchAuthMode: (mode: AuthMode) => void;
  login: (mode: AuthMode) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export interface AuthState {
  authMode: AuthMode;
  userType: UserType;
  isAuthenticated: boolean;
  canSwitchModes: boolean;
  isLoading: boolean;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}
