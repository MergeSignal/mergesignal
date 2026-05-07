// Application-owned input primitive. Wraps Mantine TextInput internally.
// Do NOT import @mantine/core/TextInput in feature code — use this instead.
// Import path: app/components/shared/MSInput/MSInput
import { TextInput } from "@mantine/core";
import styles from "./MSInput.module.css";

export type MSInputProps = {
  label?: string;
  error?: string;
  description?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function MSInput({
  label,
  error,
  description,
  className,
  id,
  name,
  placeholder,
  disabled,
  value,
  onChange,
  type,
  ...rest
}: MSInputProps) {
  return (
    <TextInput
      label={label}
      error={error}
      description={description}
      id={id}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      value={value as string | undefined}
      onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
      type={type}
      classNames={{
        root: className,
        input: styles.input,
        label: styles.label,
        error: styles.error,
        description: styles.description,
      }}
      {...(rest as Record<string, unknown>)}
    />
  );
}
