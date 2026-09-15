import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function MonthPicker({ value, onChange }: { value: number[]; onChange: (months: number[]) => void }) {
  const labels = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {labels.map((l, i) => {
        const m = i + 1;
        const on = value.includes(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b))}
            className={cn(
              "h-9 rounded-lg border text-sm font-medium transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
