import type * as React from "react";
import { cn } from "../../lib/utils";

export type CheckboxProps = Omit<React.ComponentProps<"input">, "onChange" | "type"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function Checkbox({ checked, onCheckedChange, className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 accent-primary rounded border border-primary bg-background shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50",
        className,
      )}
      checked={checked}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      {...props}
    />
  );
}
