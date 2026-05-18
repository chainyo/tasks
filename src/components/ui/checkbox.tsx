import { Check } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils";

export type CheckboxProps = Omit<React.ComponentProps<"input">, "onChange" | "type"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label className="relative grid size-4 shrink-0 place-items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 place-items-center rounded border border-muted-foreground bg-background text-primary-foreground shadow-xs transition-colors peer-checked:border-primary peer-checked:bg-primary peer-disabled:opacity-50",
          className,
        )}
      >
        {checked ? <Check aria-hidden="true" className="size-3 stroke-[3]" /> : null}
      </span>
    </label>
  );
}
