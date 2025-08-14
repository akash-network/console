import { hoursToSeconds } from "date-fns";
import { z } from "zod";

export const schema = z.object({
  EVENT_BROKER_POSTGRES_URI: z.string(),
  EVENT_BROKER_ARCHIVE_COMPLETED_AFTER_SECONDS: z.number().default(hoursToSeconds(24)),
  APP_NAME: z.string()
});

export type BrokerEnvConfig = z.infer<typeof schema>;
