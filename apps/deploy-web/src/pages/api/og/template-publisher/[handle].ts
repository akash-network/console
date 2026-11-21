import { definePreviewImageHandler } from "@src/lib/nextjs/previewImage/definePreviewImageHandler";

export default definePreviewImageHandler({
  route: "/api/og/template-publisher/[handle]",
  param: "handle",
  draw: (previewImages, handle) => previewImages.publisher(handle)
});
