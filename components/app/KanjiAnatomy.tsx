"use client";

import { Fragment } from "react";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import type { Kanji, KanjiPart, RelatedKanji } from "@/lib/content";
import { useT } from "@/lib/i18n/client";
import { Tooltip } from "./Tooltip";

type Anatomy = Pick<Kanji, "char" | "parts" | "radical" | "radicalPart" | "mnemonic" | "usedIn">;

/**
 * Kanji and kana runs, so they can be set in the Japanese face.
 *
 * The body face has no CJK glyphs; left alone, the 木 inside "a tree (木)"
 * falls back to whatever the system picks and sits visibly off the line.
 */
const JAPANESE_RUN = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+)/u;

function WithJapanese({ text }: { text: string }) {
  return (
    <>
      {text.split(JAPANESE_RUN).map((piece, i) =>
        i % 2 === 1 ? (
          <span key={i} className="jp">
            {piece}
          </span>
        ) : (
          <Fragment key={i}>{piece}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * How a kanji is put together and how to remember it: the story, the parts it
 * is built from, its radical, and where it turns up again.
 *
 * - teach: the lesson's introduction card. Explains a part only the first time
 *   the curriculum meets it, so a learner is taught 亻 once, not every time.
 * - reference: the kanji browser. Everything, every time.
 * - compact: the lesson overview. The story and the parts, no explanations.
 */
export function KanjiAnatomy({
  kanji,
  variant,
  onTint = false,
}: {
  kanji: Anatomy;
  variant: "teach" | "reference" | "compact";
  /** Sitting on a cream or sage card, where the text colours differ. */
  onTint?: boolean;
}) {
  const t = useT();
  const a = t.kanji.anatomy;
  const heading = onTint ? "var(--on-tint-heading)" : "var(--text-heading)";
  const body = onTint ? "var(--on-tint-body)" : "var(--text-body)";
  const tile = onTint ? "var(--surface-card)" : "var(--surface-sunken)";

  if (!kanji.mnemonic && kanji.parts.length === 0) return null;

  const radicalIsPart = kanji.parts.some((p) => p.char === kanji.radical);
  const radicalIsSelf = kanji.radical === kanji.char;

  if (variant === "compact") {
    return (
      <div className="stack" style={{ gap: 8 }}>
        {kanji.mnemonic && (
          <p className="body-sm" style={{ margin: 0, color: body }}>
            <WithJapanese text={kanji.mnemonic} />
          </p>
        )}
        {kanji.parts.length > 0 && (
          <div className="row body-sm" style={{ gap: 12, flexWrap: "wrap", color: body }}>
            {kanji.parts.map((p) => (
              <span key={p.char}>
                <span className="jp" style={{ color: heading, fontSize: 16 }}>
                  {p.char}
                </span>{" "}
                {p.role ?? p.meaning}
                {p.char === kanji.radical && a.radicalTag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {kanji.mnemonic && (
        <div
          className="stack"
          style={{
            gap: 8,
            padding: "16px 18px",
            borderRadius: "var(--radius-md)",
            background: tile,
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <Sparkle size={13} color={heading} />
            <span className="eyebrow" style={{ color: body }}>
              {a.howToRemember}
            </span>
          </div>
          <p style={{ margin: 0, color: heading, lineHeight: "var(--leading-body)" }}>
            <WithJapanese text={kanji.mnemonic} />
          </p>
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="eyebrow" style={{ color: body }}>
            {kanji.parts.length ? a.builtFrom : a.basicShape}
          </span>
          <PartsHelp color={body} />
        </div>

        {kanji.parts.length === 0 && (
          <p className="body-sm" style={{ margin: 0, color: body }}>
            {a.notBuilt}
          </p>
        )}

        {kanji.parts.map((p) => (
          <PartRow
            key={p.char}
            part={p}
            isRadical={p.char === kanji.radical}
            isNew={p.firstSeen === kanji.char}
            showNote={variant === "reference" || p.firstSeen === kanji.char}
            heading={heading}
            body={body}
            tile={tile}
          />
        ))}

        {kanji.radicalPart && !radicalIsPart && (
          <p className="body-sm" style={{ margin: 0, color: body }}>
            {radicalIsSelf ? (
              <>
                <strong style={{ color: heading }}>{a.radicalItself}</strong>
                {kanji.radicalPart.name && (
                  <>
                    , <span className="jp">{kanji.radicalPart.name}</span>
                  </>
                )}
                {a.radicalItselfTail}
              </>
            ) : (
              <>
                <strong style={{ color: heading }}>
                  {a.radical} <span className="jp">{kanji.radicalPart.char}</span>
                </strong>{" "}
                {kanji.radicalPart.meaning}
                {kanji.radicalPart.name && (
                  <>
                    {" "}
                    (<span className="jp">{kanji.radicalPart.name}</span>)
                  </>
                )}
                {" — "}
                {a.radicalHidden}
              </>
            )}
          </p>
        )}
      </div>

      {kanji.usedIn.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow" style={{ color: body }}>
            {variant === "teach" ? a.seeAgainIn : a.partOf}
          </span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {kanji.usedIn.map((k) => (
              <Tooltip
                key={k.char}
                label={`${k.char}: ${k.meanings.join(", ")}`}
                content={<RelatedKanjiInfo kanji={k} />}
                triggerStyle={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: tile,
                  color: heading,
                  fontFamily: "var(--font-jp)",
                  fontSize: 20,
                  lineHeight: 1.3,
                }}
                openStyle={{ boxShadow: "inset 0 0 0 1.5px var(--border-strong)" }}
              >
                {k.char}
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A small circled "i", the usual sign for "more about this". */
function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/**
 * What radicals and parts are, kept behind a small icon: worth reading once,
 * clutter every time after.
 */
function PartsHelp({ color }: { color: string }) {
  const a = useT().kanji.anatomy;
  return (
    <Tooltip
      label={a.partsHelpTitle}
      width={300}
      triggerStyle={{ display: "inline-flex", alignItems: "center", color }}
      content={
        <div className="stack" style={{ gap: 8 }}>
          <strong style={{ color: "var(--text-heading)" }}>{a.partsHelpTitle}</strong>
          <span>{a.partsHelpBody}</span>
          <span>
            {a.partsHelpRadical({
              strong: (text) => <strong style={{ color: "var(--text-heading)" }}>{text}</strong>,
              jp: (text) => <span className="jp">{text}</span>,
            })}
          </span>
        </div>
      }
    >
      <InfoIcon />
    </Tooltip>
  );
}

function RelatedKanjiInfo({ kanji }: { kanji: RelatedKanji }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <span className="jp" style={{ fontSize: 34, lineHeight: 1, color: "var(--text-heading)" }}>
          {kanji.char}
        </span>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <strong style={{ color: "var(--text-heading)" }}>{kanji.meanings.join(", ")}</strong>
          <span className="muted">{t.kanji.anatomy.lesson(kanji.lessonOrder)}</span>
        </div>
      </div>
      {(
        [
          [t.kanji.on, kanji.onyomi],
          [t.kanji.kun, kanji.kunyomi],
        ] as const
      ).map(([label, readings]) => (
        <div key={label} className="row" style={{ gap: 10, alignItems: "baseline" }}>
          <span className="eyebrow" style={{ width: 30, flex: "0 0 auto" }}>
            {label}
          </span>
          <span className="jp" style={{ color: "var(--text-heading)" }}>
            {readings.length ? readings.join("・") : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function PartRow({
  part,
  isRadical,
  isNew,
  showNote,
  heading,
  body,
  tile,
}: {
  part: KanjiPart;
  isRadical: boolean;
  isNew: boolean;
  showNote: boolean;
  heading: string;
  body: string;
  tile: string;
}) {
  const a = useT().kanji.anatomy;
  return (
    <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
      <span
        className="jp"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          background: tile,
          color: heading,
          fontSize: 26,
          lineHeight: 1,
        }}
      >
        {part.char}
      </span>
      <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: heading, fontWeight: "var(--weight-semibold)" }}>
            {part.role ?? part.meaning}
          </span>
          {/* The role is what the story calls it; the usual meaning is what
              the part will mean in the next kanji, so both are worth seeing. */}
          {part.role && (
            <span className="body-sm" style={{ color: body }}>
              {a.usually(part.meaning)}
            </span>
          )}
          {part.name && (
            <span className="jp body-sm" style={{ color: body }}>
              {part.name}
            </span>
          )}
          {isRadical && <Badge tone="accent">{a.radicalBadge}</Badge>}
          {isNew ? (
            <Badge tone="soft">{a.newPart}</Badge>
          ) : (
            <span className="body-sm" style={{ color: body }}>
              {a.seenIn(part.firstLesson)}
              {part.firstSeen !== part.char && (
                <>
                  {a.seenInKanji}
                  <span className="jp">{part.firstSeen}</span>
                </>
              )}
            </span>
          )}
        </div>
        {showNote && part.note && (
          <p className="body-sm" style={{ margin: 0, color: body }}>
            <WithJapanese text={part.note} />
          </p>
        )}
      </div>
    </div>
  );
}
