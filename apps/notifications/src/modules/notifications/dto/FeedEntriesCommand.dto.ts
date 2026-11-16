import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { FeedEntrySchema } from "./NotificationCommand.dto";

const FeedEntriesCommandSchema = z.object({
  feedEntries: z.array(FeedEntrySchema.required({ summary: true })).min(1)
});

export class FeedEntriesCommandDto extends createZodDto(FeedEntriesCommandSchema) {}
