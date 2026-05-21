"use client";

import { MantineProvider, type CSSVariablesResolver } from "@mantine/core";
import "@mantine/core/styles.css";
import { theme } from "../../../theme";

// cssVariablesResolver: the single bridge that forwards every --mantine-*
// CSS variable to the corresponding --ms-* design token. All Mantine
// components consume --mantine-* internally, so this mapping automatically
// applies the application's brand to every Mantine primitive without
// hardcoding any values in component files.
const resolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-font-family": "var(--ms-type-body-font-family)",
    "--mantine-font-family-headings": "var(--ms-type-body-font-family)",
    "--mantine-font-family-monospace": "var(--ms-type-mono-inline-font-family)",
    "--mantine-radius-xs": "var(--ms-radius-xs)",
    "--mantine-radius-sm": "var(--ms-radius-sm)",
    "--mantine-radius-md": "var(--ms-radius-md)",
    "--mantine-radius-lg": "var(--ms-radius-lg)",
    "--mantine-spacing-xs": "var(--ms-space-xs)",
    "--mantine-spacing-sm": "var(--ms-space-sm)",
    "--mantine-spacing-md": "var(--ms-space-md)",
    "--mantine-spacing-lg": "var(--ms-space-lg)",
    "--mantine-spacing-xl": "var(--ms-space-xl)",
    "--mantine-shadow-sm": "var(--ms-shadow-sm)",
    "--mantine-shadow-md": "var(--ms-shadow-md)",
  },
  dark: {
    "--mantine-color-body": "var(--ms-color-canvas)",
    "--mantine-color-text": "var(--ms-color-ink)",
    "--mantine-color-dimmed": "var(--ms-color-text-muted)",
    "--mantine-color-bright": "var(--ms-color-text-emphasis)",
    "--mantine-color-placeholder": "var(--ms-color-text-muted)",
    "--mantine-color-anchor": "var(--ms-color-accent)",
    "--mantine-color-default": "var(--ms-color-surface)",
    "--mantine-color-default-hover": "var(--ms-color-surface-emphasis)",
    "--mantine-color-default-border": "var(--ms-color-border)",
    "--mantine-color-error": "var(--ms-color-danger)",
  },
  // Light scheme not yet designed — extend this block when light mode is introduced.
  // Corresponding --ms-* light values go in globals.css.
  light: {},
});

export function MantineProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="dark"
      cssVariablesResolver={resolver}
    >
      {children}
    </MantineProvider>
  );
}
