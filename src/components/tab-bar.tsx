"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sprout, Map, CalendarCheck } from "lucide-react";
import { cn } from "cn";

const tabs = [
  { href: "/", label: "Hjem", icon: Home },
  { href: "/planter/", label: "Planter", icon: Sprout },
  { href: "/kart/", label: "Kart", icon: Map },
  { href: "/oppgaver/", label: "Oppgaver", icon: CalendarCheck },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "";
  if (href === "/planter/") return pathname.startsWith("/planter") || pathname.startsWith("/plante");
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hovedmeny"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto grid h-(--tabbar-height) max-w-lg grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent"
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
