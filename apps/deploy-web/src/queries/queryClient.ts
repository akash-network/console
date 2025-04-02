import { QueryClient as LegacyQueryClient } from "react-query";
import { QueryClient } from "@tanstack/react-query";

const legacyQueryClient = new LegacyQueryClient();
const queryClient = new QueryClient();

export { legacyQueryClient, queryClient };
