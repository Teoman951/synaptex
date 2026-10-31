import type { SynaptexDesktopApi } from "@/types/desktop";

export function getDesktopApi(): SynaptexDesktopApi | undefined {
  return typeof window === "undefined" ? undefined : window.synaptexDesktop;
}
