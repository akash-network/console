import { useCustomUser } from "@src/hooks/useCustomUser";
import { UserSettings } from "@src/types/user";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";
import { useMutation } from "react-query";

export function useSaveSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<any, any>, unknown, UserSettings>(newSettings => axios.put("/api/proxy/user/updateSettings", newSettings), {
    onSuccess: () => {
      enqueueSnackbar("Settings saved", { variant: "success" });

      checkSession();
    },
    onError: () => {
      enqueueSnackbar("Error saving settings", { variant: "error" });
    }
  });
}
