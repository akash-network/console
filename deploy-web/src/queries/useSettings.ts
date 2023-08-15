import { useUser } from "@auth0/nextjs-auth0";
import { UserSettings } from "@src/types/user";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";
import { useMutation } from "react-query";

export function useSaveSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useUser();

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
