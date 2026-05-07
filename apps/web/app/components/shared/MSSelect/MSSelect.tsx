// Application-owned select primitive. Wraps Mantine Select internally.
// Do NOT import @mantine/core/Select in feature code — use this instead.
// Import path: app/components/shared/MSSelect/MSSelect
import { Select } from "@mantine/core";
import styles from "./MSSelect.module.css";

export type MSSelectProps = {
  data: Array<{ value: string; label: string }> | string[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
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
}: MSSelectProps) {
  return (
    <Select
      data={data}
      value={value}
      onChange={onChange}
      label={label}
      error={error}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      classNames={{
        root: className,
        input: styles.input,
        dropdown: styles.dropdown,
        option: styles.option,
        label: styles.label,
        error: styles.error,
      }}
    />
  );
}
