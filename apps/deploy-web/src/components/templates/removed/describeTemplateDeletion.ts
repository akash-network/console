type DeletedTemplate = { publishedAt: string | null };

const ONCE_PUBLIC_DELETION =
  "The template and all its versions are deleted. It leaves the gallery, and anyone who opens its link is told it was removed. Deployments made from it keep running. This can't be undone.";

/** A template that was public once keeps its link as a "removed" page, so its deletion is described differently from one nobody outside ever saw. */
export function describeTemplateDeletion(template: DeletedTemplate, neverPublicDeletion: string): string {
  return template.publishedAt ? ONCE_PUBLIC_DELETION : neverPublicDeletion;
}
