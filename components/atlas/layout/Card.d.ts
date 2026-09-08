import * as React from "react";

/**
 * The Atlas surface. Tinted grounds (cream / sage) carry most content; white cards
 * float above them with a soft green-tinted shadow; forest cards are the emphasis case.
 *
 * @startingPoint section="Layout" subtitle="Card tones, padding and elevation" viewport="700x340"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  tone?: "white" | "cream" | "sage" | "forest" | "accent";
  /** none | sm 20 | md 32 | lg 40 */
  pad?: "none" | "sm" | "md" | "lg";
  /** card 24 | lg 28 | md 16 | sm 12 */
  radius?: "card" | "lg" | "md" | "sm";
  elevation?: "none" | "sm" | "md" | "lg";
  bordered?: boolean;
  /**
   * Lift the card on hover. Off by default, because Atlas specifies that cards
   * change colour on hover rather than move — see the note in Card.jsx. Turn it
   * on only for cards that are themselves links, where the lift reads as an
   * affordance; on a card the reader is reading from it is just noise.
   */
  hover?: boolean;
}
export declare function Card(props: CardProps): JSX.Element;
