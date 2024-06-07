export const useDocHeight = () => {
  if (typeof document === "undefined") return 0;

  const body = document.body,
    html = document.documentElement;

  const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

  return height;
};
