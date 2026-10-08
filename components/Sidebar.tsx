"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { IconGrid, IconKey, IconLogout, IconShield } from "./icons";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: IconGrid },
  { href: "/blocked", label: "Blocked", icon: IconShield },
  { href: "/keys", label: "Keys", icon: IconKey },
];

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/login", { method: "DELETE" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const desktopNav = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-subtle-strong text-strong shadow-[inset_0_1px_0_var(--line)]"
                : "text-muted hover:bg-subtle hover:text-strong"
            }`}
          >
            <ItemIcon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : ""}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const mobileNav = (
    <nav className="flex items-center gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              active ? "bg-subtle-strong text-strong" : "text-muted hover:bg-subtle hover:text-strong"
            }`}
          >
            <ItemIcon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : ""}`} />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="px-2">
          <Logo />
        </Link>

        <div className="mt-8 flex-1">{desktopNav}</div>

        <div className="space-y-4">
          <div className="divider" />
          <div className="flex items-center justify-between gap-1 px-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg">{username}</p>
              <p className="text-[10px] uppercase tracking-wider text-faint">Administrator</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sign out"
                className="btn btn-ghost !px-2"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <div className="flex items-center gap-0.5">
          {mobileNav}
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out"
            className="btn btn-ghost !px-2"
          >
            <IconLogout className="h-4 w-4" />
          </button>
        </div>
      </header>
    </>
  );
}
