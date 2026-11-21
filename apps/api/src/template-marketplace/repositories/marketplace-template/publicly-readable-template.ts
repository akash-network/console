import { and, eq, type SQL, sql } from "drizzle-orm";

import { TemplatePublishers } from "@src/template-marketplace/model-schemas/template-publisher/template-publisher.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";

/** A suspended publisher's public templates read as hidden to everyone outside its organization, so reinstating the publisher brings them back with nothing to restore. */
export function publiclyReadableTemplate(): SQL | undefined {
  return and(eq(Templates.visibility, "public"), eq(Templates.moderationStatus, "active"), publisherInGoodStanding());
}

export function publisherInGoodStanding(): SQL {
  return sql`not exists (
    select 1 from ${TemplatePublishers}
    where ${TemplatePublishers.organizationId} = ${Templates.organizationId} and ${TemplatePublishers.publishingSuspendedAt} is not null
  )`;
}
