export const customColors = {
  white: "#FFFFFF",
  black: "#000000",
  lightBg: "#f3f3f3",
  green: "#50FF76",
  main: "#E85A39",
  link: "#EE853E",
  dark: "#0c0b0b",
  darkLight: "#101010",
  brown: "#874302",
  akashRed: "#ff424c",
  vsDark: "#1e1e1e",
  vsDarkFont: "#d4d4d4"
};

export const burningGradient = "linear-gradient(90deg,#EF8C3D 0%,#E54348 100%)";
export const burningGradientStyle = {
  background: burningGradient,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  textFillColor: "transparent"
};

export function HSLToHex(_hsl: string) {
  const sep = _hsl.indexOf(",") > -1 ? "," : " ";
  const hsl = _hsl.substring(4).split(")")[0].split(sep);

  const hString: string = hsl[0];
  let h = parseInt(hsl[0]),
    s = parseInt(hsl[1].substring(0, hsl[1].length - 1)) / 100,
    l = parseInt(hsl[2].substring(0, hsl[2].length - 1)) / 100;

  if (hString.indexOf("deg") > -1) h = parseInt(hString.substring(0, hString.length - 3));
  else if (hString.indexOf("rad") > -1) h = Math.round(parseInt(hString.substring(0, hString.length - 3)) * (180 / Math.PI));
  else if (hString.indexOf("turn") > -1) h = Math.round(parseInt(hString.substring(0, hString.length - 4)) * 360);
  if (h >= 360) h %= 360;

  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  let r: string | number = 0,
    g: string | number = 0,
    b: string | number = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  r = Math.round((r + m) * 255).toString(16);
  g = Math.round((g + m) * 255).toString(16);
  b = Math.round((b + m) * 255).toString(16);

  if (r.length == 1) r = "0" + r;
  if (g.length == 1) g = "0" + g;
  if (b.length == 1) b = "0" + b;

  return "#" + r + g + b;
}
