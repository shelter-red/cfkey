export type UrlLocation = {
  protocol: string;
  href: string;
};

export function httpsLocation(value: UrlLocation): string | null {
  if (value.protocol !== "http:") return null;
  const target = new URL(value.href);
  target.protocol = "https:";
  return target.toString();
}
