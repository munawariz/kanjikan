"use client";

import React from "react";

/* DEVIATION FROM ATLAS — deliberate, requested, and opt-in.
   The Atlas readme states: "Cards do not lift, scale, or grow their shadow on
   hover" and "Hover states. Colour, not motion." This copy can lift a card on
   hover, but only where a caller asks for it with hover.

   Off by default, so every card that is a surface to read from behaves exactly
   as Atlas specifies. It is switched on for the lesson tiles, which are links
   and where the lift reads as an affordance rather than noise.

   Where it is on, the motion still obeys the system: 140ms (--duration-fast) on
   the single --ease-standard curve, no bounce or overshoot, and one shadow
   layer only. A bordered card lifts and darkens its border instead of gaining a
   shadow, because Atlas forbids a card carrying both at once. */

const TONES = {
  white: { background: "var(--surface-card)", color: "var(--text-body)" },
  cream: { background: "var(--surface-card-cream)", color: "var(--text-body)" },
  sage: { background: "var(--surface-card-sage)", color: "var(--text-body)" },
  forest: { background: "var(--surface-inverse)", color: "var(--text-inverse-muted)" },
  accent: { background: "var(--surface-accent)", color: "var(--text-on-accent)" },
};

/** One step up the elevation ramp, so a card keeps a single shadow layer. */
const HOVER_ELEVATION = { none: "sm", sm: "md", md: "lg", lg: "lg" };

export function Card({
  children,
  tone = "white",
  pad = "md",
  radius = "card",
  elevation = "none",
  bordered = false,
  hover = false,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) {
  const pads = { none: 0, sm: 20, md: 32, lg: 40 };
  const radii = { card: "var(--radius-card)", lg: "var(--radius-card-lg)", md: "var(--radius-md)", sm: "var(--radius-sm)" };
  const shadows = { none: "none", sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)" };
  const t = TONES[tone] || TONES.white;

  const [isHover, setIsHover] = React.useState(false);
  const lifted = hover && isHover;

  const restingShadow = shadows[elevation] || "none";
  const borderColour = tone === "forest" ? "var(--border-inverse)" : "var(--border-subtle)";

  return (
    <div
      onMouseEnter={
        hover
          ? (e) => {
              setIsHover(true);
              onMouseEnter?.(e);
            }
          : onMouseEnter
      }
      onMouseLeave={
        hover
          ? (e) => {
              setIsHover(false);
              onMouseLeave?.(e);
            }
          : onMouseLeave
      }
      style={{
        position: "relative",
        // Lifted cards paint above their neighbours, so a hover shadow is never
        // clipped by the card sitting next to it in a grid.
        zIndex: lifted ? 1 : 0,
        overflow: "hidden",
        padding: pads[pad] ?? pads.md,
        borderRadius: radii[radius] || radii.card,
        // A bordered card must not gain a shadow: Atlas allows one or the
        // other, never both. It darkens its hairline instead.
        boxShadow: bordered
          ? restingShadow
          : lifted
            ? shadows[HOVER_ELEVATION[elevation] || "sm"]
            : restingShadow,
        border: bordered
          ? "1px solid " + (lifted ? "var(--border-strong)" : borderColour)
          : "none",
        // Only cards that opt in carry the transform and transition at all, so
        // a static card stays exactly the plain surface Atlas describes.
        ...(hover
          ? {
              transform: lifted ? "translateY(-3px)" : "none",
              transition:
                "transform var(--duration-fast) var(--ease-standard)," +
                "box-shadow var(--duration-fast) var(--ease-standard)," +
                "border-color var(--duration-fast) var(--ease-standard)",
            }
          : null),
        ...t,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
