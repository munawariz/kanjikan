"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * A button that shows a small popup of extra detail.
 *
 * Opens on hover for a mouse, on focus for a keyboard, and on tap for a finger
 * — a phone has no hover, so a hover-only tooltip there is detail nobody can
 * reach. A tap pins it open until the next tap, a tap elsewhere, Escape, or a
 * scroll.
 *
 * The popup is positioned against the window rather than inside the page: the
 * cards it sits in clip their overflow, which would cut a popup off at the
 * card's edge, and a character near the edge of a phone screen would push a
 * centred popup off the screen. It is clamped to stay fully visible, and flips
 * below its button when there is no room above.
 */
export function Tooltip({
  label,
  content,
  children,
  width = 240,
  triggerStyle,
  openStyle,
}: {
  /** Accessible name for the button. */
  label: string;
  content: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  triggerStyle?: React.CSSProperties;
  /** Added while the popup is showing, to mark which button it belongs to. */
  openStyle?: React.CSSProperties;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    pinned.current = false;
    setOpen(false);
    setPos(null);
  }, []);
  // Hover and focus leaving close it only if a tap has not pinned it.
  const release = useCallback(() => {
    if (!pinned.current) hide();
  }, [hide]);

  // Measured after it renders hidden, so the real size decides the position.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const margin = 8;
    const gap = 8;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(
      Math.max(trigger.left + trigger.width / 2 - w / 2, margin),
      window.innerWidth - w - margin,
    );
    const above = trigger.top - h - gap;
    setPos({ left, top: above >= margin ? above : trigger.bottom + gap });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !tipRef.current?.contains(target)) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    // A fixed popup would otherwise float away from its button.
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hide]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={release}
        onFocus={show}
        onBlur={release}
        onClick={() => {
          // A tap fires mouseenter first, so the popup is already open here;
          // the click decides whether it stays.
          if (pinned.current) {
            hide();
          } else {
            pinned.current = true;
            show();
          }
        }}
        style={{
          font: "inherit",
          color: "inherit",
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          // The browser's own tap flash is a blue box that belongs to no
          // design; openStyle marks the open button instead.
          WebkitTapHighlightColor: "transparent",
          transition: "var(--transition-control)",
          ...triggerStyle,
          ...(open ? openStyle : null),
        }}
      >
        {children}
      </button>

      {open && (
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{
            position: "fixed",
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            // Hidden until measured, so it never flashes at the corner.
            visibility: pos ? "visible" : "hidden",
            zIndex: 60,
            width: `min(${width}px, calc(100vw - 16px))`,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-md)",
            color: "var(--text-body)",
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--leading-body-tight)",
            textAlign: "left",
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
