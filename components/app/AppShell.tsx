"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { Avatar } from "@/components/atlas/data/Avatar.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "house" },
  { href: "/path", label: "Path", icon: "chart-line" },
  { href: "/lessons", label: "Lessons", icon: "file-text" },
  { href: "/review", label: "Review", icon: "zap" },
  { href: "/writing", label: "Writing", icon: "file-text" },
  { href: "/kanji", label: "Kanji", icon: "grid-2x2" },
  { href: "/progress", label: "Progress", icon: "line-chart" },
];

/**
 * Application chrome. Atlas keeps its header static rather than sticky, and
 * marks the active item with a lime underline instead of a filled pill.
 */
export function AppShell({
  name,
  dueCount,
  signOut,
  children,
}: {
  name: string;
  dueCount: number;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div
          className="page row"
          style={{ height: 76, justifyContent: "space-between", gap: 24 }}
        >
          <div className="row" style={{ gap: 40, minWidth: 0 }}>
            <Link href="/dashboard" className="reset-link">
              <Wordmark />
            </Link>

            <nav className="row app-nav" style={{ gap: 4 }}>
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="reset-link row"
                    style={{
                      gap: 8,
                      height: 76,
                      padding: "0 12px",
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--weight-semibold)",
                      letterSpacing: "var(--tracking-label)",
                      color: active ? "var(--text-heading)" : "var(--text-body)",
                      boxShadow: active ? "inset 0 -1.5px 0 0 var(--lime-500)" : "none",
                      transition: "var(--transition-control)",
                    }}
                  >
                    <Icon name={item.icon} size={16} />
                    {item.label}
                    {item.href === "/review" && dueCount > 0 && (
                      <Badge tone="accent" style={{ height: 20, padding: "0 8px" }}>
                        {dueCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <ThemeToggle />
            <span
              className="body-sm app-username"
              style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-heading)" }}
            >
              {name}
            </span>
            <Avatar name={name || "Learner"} size={38} />
            {signOut}
          </div>
        </div>
      </header>

      <div className="page app-content" style={{ paddingTop: 40, paddingBottom: 96 }}>
        {children}
      </div>

      {/* Below 900px the labelled nav will not fit beside the wordmark, so it
          moves to a scrollable strip under the header. */}
      <style>{`
        @media (max-width: 900px) {
          .app-nav {
            position: fixed;
            left: 0; right: 0; bottom: 0;
            z-index: 20;
            justify-content: space-around;
            background: var(--surface-card);
            border-top: 1px solid var(--border-subtle);
            padding: 0 8px;
          }
          .app-nav a { height: 62px; flex-direction: column; gap: 3px !important; font-size: 11px; }
          .app-username { display: none; }
          .app-content { padding-bottom: 110px !important; }
        }
      `}</style>
    </>
  );
}
