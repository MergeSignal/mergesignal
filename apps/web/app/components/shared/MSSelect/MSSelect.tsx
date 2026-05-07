// Application-owned select primitive. Wraps Mantine Select internally.
// Do NOT import @mantine/core/Select in feature code — use this instead.
// Import path: app/components/shared/MSSelect/MSSelect
import { Select } from "@mantine/core";
import styles from "./MSSelect.module.css";

/** Single row in a flat or grouped select list. */
export type MSSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/** Grouped section (Mantine `Select` combobox group). */
export type MSSelectGroupSection = {
  group: string;
  items: MSSelectOption[];
};

/** Data accepted by `MSSelect`: flat options, grouped sections, or string shorthand. */
export type MSSelectData = string[] | MSSelectOption[] | MSSelectGroupSection[];

function isGroupedSelectData(
  data: MSSelectData,
): data is MSSelectGroupSection[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "group" in first &&
    "items" in first
  );
}

export type MSSelectProps = {
  data: MSSelectData;
  value?: string | null;
  onChange?: (value: string | null) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Ellipsis + overflow hidden on the closed control input (use with a tooltip for full label). */
  truncateSelection?: boolean;
};

export function MSSelect({
  data,
  value,
  onChange,
  label,
  error,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
  className,
  truncateSelection,
}: MSSelectProps) {
  const grouped = isGroupedSelectData(data);
  const selectData = grouped
    ? data.filter((section) => section.items.length > 0)
    : data;

  return (
    <Select
      data={selectData}
      value={value}
      onChange={onChange}
      label={label}
      error={error}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      classNames={{
        root: [className, truncateSelection && styles.rootMinWidth]
          .filter(Boolean)
          .join(" "),
        input: [styles.input, truncateSelection && styles.inputTruncated]
          .filter(Boolean)
          .join(" "),
        dropdown: styles.dropdown,
        option: styles.option,
        label: styles.label,
        error: styles.error,
        ...(grouped
          ? { group: styles.group, groupLabel: styles.groupLabel }
          : {}),
      }}
    />
  );
}
