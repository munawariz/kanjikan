"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { Avatar } from "@/components/atlas/data/Avatar.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Seven destinations, seven distinct glyphs.
 *
 * They have to be distinguishable on their own: on a narrow phone the labels
 * are dropped so all seven tabs fit, and two items sharing an icon there would
 * be indistinguishable. See the label breakpoint in the style block below.
 */
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "house" },
  { href: "/path", label: "Path", icon: "route" },
  { href: "/lessons", label: "Lessons", icon: "file-text" },
  { href: "/review", label: "Review", icon: "zap" },
  { href: "/writing", label: "Writing", icon: "pen-line" },
  { href: "/kanji", label: "Kanji", icon: "grid-2x2" },
  { href: "/progress", label: "Progress", icon: "chart-line" },
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
          className="page row app-header"
          style={{ height: 76, justifyContent: "space-between", gap: 16 }}
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
                    // Carries the accessible name once the label is hidden on
                    // narrow screens, and drives the mobile active style, which
                    // an inline style cannot express per-breakpoint.
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    data-active={active}
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
                    <Icon name={item.icon} size={18} />
                    <span className="nav-label">{item.label}</span>
                    {item.href === "/review" && dueCount > 0 && (
                      <Badge
                        tone="accent"
                        className="nav-badge"
                        style={{ height: 20, padding: "0 8px" }}
                      >
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

      {/* Two breakpoints, doing different jobs.

          The first moves the nav out of the header and pins it to the bottom,
          within thumb reach. The second, further down, drops the tab labels
          once seven of them stop fitting across the width — and shortens the
          bar to match, since an icon needs less height than an icon over a
          label. Both heights come from --nav-tab-h so the page's bottom
          padding tracks them automatically.

          The label survives as the accessible name, so screen readers and
          long-press still get it. Safe-area padding keeps the bar clear of the
          iOS home indicator. */}
      <style
        // Set as raw HTML rather than as a text child: React escapes and then
        // re-checks text content during hydration, so a single apostrophe in a
        // CSS comment renders as &#x27; on the server, mismatches on the client,
        // and makes React discard the server HTML and re-render the whole root.
        dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1200px) {
          :root {
            /* THE bottom-bar height. Tab height and the page's bottom padding
               are both derived from it, so they cannot drift apart. */
            --nav-tab-h: 52px;
          }

          .app-header { height: 60px !important; }

          .app-nav {
            position: fixed;
            left: 0; right: 0; bottom: 0;
            z-index: 20;
            /* One number decides the bar's height, and the page padding below
               is computed from it. Previously both were hand-written and had
               drifted ~37px apart from the height they were meant to clear.

               The safe-area inset is ADDED to that height rather than absorbed
               by it. With border-box the padding sits inside the box, so a
               device reporting an 18px inset was left with only 26px of usable
               height and the tabs were clipped. */
            height: calc(var(--nav-tab-h) + env(safe-area-inset-bottom, 0px));
            background: var(--surface-card);
            border-top: 1px solid var(--border-subtle);
            /* env(), not a fixed value: the inset is 0 on Android and desktop,
               where a hardcoded number would just be dead space. */
            padding: 0 6px env(safe-area-inset-bottom, 0px);
            /* The inline gap:4 and space-around were dividing the leftover
               space unevenly. Equal flex tabs give every destination exactly
               one seventh, which is what makes the row look regular. */
            gap: 2px !important;
            /* Equal-height tabs regardless of which ones carry a label; the
               base .row centres them, which would leave them ragged. */
            align-items: stretch;
          }
          .app-nav a {
            position: relative;
            flex: 1 1 0;
            min-width: 0;
            /* Fills the bar, so --nav-tab-h alone decides the height and the
               tab never has vertical padding of its own to disagree with it.

               !important is required: the tab carries an inline height: 76 for
               the desktop header, and an inline style beats a stylesheet rule
               without it. Every tab was silently staying 76px tall and hanging
               below the bar. */
            height: 100% !important;
            flex-direction: column;
            justify-content: center;
            gap: 4px !important;
            padding: 0 2px !important;
            border-radius: var(--radius-sm);
            font-size: 10px;
            letter-spacing: 0;
            box-shadow: none !important;
          }
          .app-nav a .nav-label {
            /* Never wrap: a two-line label makes one tab taller than the rest
               and the whole bar loses its baseline. */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .app-nav a[data-active="true"] {
            color: var(--text-heading) !important;
            background: var(--surface-sunken);
          }
          /* Out of the flex column, so a due count cannot change tab height. */
          .app-nav .nav-badge {
            position: absolute;
            top: 2px;
            left: 50%;
            margin-left: 4px;
            height: 16px !important;
            padding: 0 5px !important;
            font-size: 10px;
          }

          .app-content {
            padding-top: 28px !important;
            /* Clears the bar, the home indicator, and a little breathing room,
               computed rather than guessed. */
            padding-bottom: calc(var(--nav-tab-h) + env(safe-area-inset-bottom, 0px) + 24px) !important;
          }
          .app-username { display: none; }
        }

        /* Seven labels stop fitting well before 480px: at 560px each tab is
           80px, and "Dashboard" at 10px is already most of that.

           Dropping the label leaves only the icon, so the bar shortens to
           match. 44px is the floor: it is the minimum comfortable tap target,
           and the tabs are already only ~48px wide on a 360px phone. */
        @media (max-width: 560px) {
          :root {
            --nav-tab-h: 44px;
            /* The square the icon sits in. Fixed, so it stays square on every
               screen; the tab around it still stretches to share the width
               evenly, but the highlight no longer stretches with it. */
            --nav-icon-box: 36px;
          }

          .app-nav a .nav-label { display: none; }

          /* The tab is still the full-width tap target — only the visible
             highlight shrinks to the square. Making the tab itself square
             would leave dead gaps between tabs that look tappable. */
          .app-nav a[data-active="true"] { background: transparent !important; }

          .app-nav a::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: var(--nav-icon-box);
            height: var(--nav-icon-box);
            transform: translate(-50%, -50%);
            border-radius: var(--radius-sm);
            background: transparent;
            transition: background-color var(--duration-fast) var(--ease-standard);
          }
          .app-nav a[data-active="true"]::before {
            background: var(--surface-sunken);
          }

          /* The square is an absolutely positioned pseudo-element, so without
             this it would paint over the icon rather than behind it. */
          .app-nav a > svg {
            position: relative;
            z-index: 1;
          }

          /* The due count belongs to the square, not to the tab.
             Anchored by its right edge to the square's right edge, so it
             stays on the corner at every screen width and a two- or
             three-digit count grows inwards instead of drifting off. */
          .app-nav .nav-badge {
            left: auto;
            margin-left: 0;
            /* Tucked 2px inside the square on both axes, so it overlaps the
               icon's top-right corner and stays within the highlight rather
               than poking out of it. Anchored by its right edge, so extra
               digits grow inwards. */
            top: calc(50% - var(--nav-icon-box) / 2 + 2px);
            right: calc(50% - var(--nav-icon-box) / 2 + 2px);
            /* Above both the square and the icon, which now has z-index 1. */
            z-index: 2;
          }
        }
      ` }}
      />
    </>
  );
}
