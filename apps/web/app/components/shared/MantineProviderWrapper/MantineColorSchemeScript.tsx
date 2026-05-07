// Server-safe script injector — no "use client" needed.
// Re-exported from the approved Mantine wrapper directory so that layout.tsx
// can inject it into <head> without violating the @mantine/core import rule.
import { ColorSchemeScript } from "@mantine/core";

export { ColorSchemeScript as MantineColorSchemeScript };
