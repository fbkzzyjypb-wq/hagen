import type { ReactNode } from "react";
import { cn } from "cn";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  leading?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, action, leading, className }: Props) {
  return (
    <header className={cn("pt-safe sticky top-0 z-30 bg-background/90 backdrop-blur-xl", className)}>
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-3 pb-3">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
