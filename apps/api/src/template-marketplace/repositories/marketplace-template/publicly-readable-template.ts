import { and, eq, isNotNull, type SQL, sql } from "drizzle-orm";

import { TemplatePublishers } from "@src/template-marketplace/model-schemas/template-publisher/template-publisher.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";

/** A suspended publisher's public templates read as hidden to everyone outside its organization, so reinstating the publisher brings them back with nothing to restore. */
export function publiclyReadableTemplate(): SQL | undefined {
  return and(eq(Templates.visibility, "public"), eq(Templates.moderationStatus, "active"), publisherInGoodStanding());
}

/** A public template saved before the publish gate never passed its checks, so it opens by link and stays out of every listing. */
export function listedTemplate(): SQL | undefined {
  return and(publiclyReadableTemplate(), eq(Templates.isListed, true), isNotNull(Templates.publishedAt));
}

export function publisherInGoodStanding(): SQL {
  return sql`not exists (
    select 1 from ${TemplatePublishers}
    where ${TemplatePublishers.organizationId} = ${Templates.organizationId} and ${TemplatePublishers.publishingSuspendedAt} is not null
  )`;
}
