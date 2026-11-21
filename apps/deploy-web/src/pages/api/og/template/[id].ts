import { definePreviewImageHandler } from "@src/lib/nextjs/previewImage/definePreviewImageHandler";

export default definePreviewImageHandler({
  route: "/api/og/template/[id]",
  param: "id",
  draw: (previewImages, id) => previewImages.template(id)
});
