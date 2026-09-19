"use client";

import Image from "next/image";
import { TILE_IMAGE, TILE_NAME_JA, type TileId } from "@/lib/tiles";

type Props = {
  tile: TileId;
  selected?: boolean;
  recommended?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  size?: "xs" | "river" | "sm" | "hand" | "md" | "lg";
  /** When true, render as non-interactive figure (rivers). */
  faceOnly?: boolean;
  /** Soft yellow glow for table selection (matches riichi UI). */
  glow?: boolean;
  /** Degrees: 下家 90 / 対面 180 / 上家 -90 / 自家 0 */
  rotate?: 0 | 90 | -90 | 180;
  /** Optional wrapper class (e.g. scale on narrow phones). */
  className?: string;
};

const SIZE = {
  xs: { w: 22, h: 30 },
  /** River / discard pond — smaller than hand for neat Tenhou ponds. */
  river: { w: 16, h: 22 },
  sm: { w: 32, h: 44 },
  /** Own hand — compact so the table stays glanceable. */
  hand: { w: 28, h: 40 },
  md: { w: 48, h: 64 },
  lg: { w: 56, h: 76 },
};

export function TileButton({
  tile,
  selected,
  recommended,
  dimmed,
  highlighted,
  onClick,
  size = "md",
  faceOnly,
  glow,
  rotate = 0,
  className: extraClass = "",
}: Props) {
  const { w, h } = SIZE[size];
  const showGlow = glow || selected;
  const sideways = rotate === 90 || rotate === -90;
  const boxW = sideways ? h : w;
  const boxH = sideways ? w : h;
  const className = [
    "relative shrink-0 rounded-md transition-transform touch-manipulation",
    !faceOnly && onClick ? "active:scale-95" : "",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
    showGlow ? "-translate-y-1.5 ring-2 ring-amber-300/90" : "",
    recommended && !showGlow ? "ring-2 ring-emerald-500 -translate-y-1" : "",
    highlighted && !showGlow ? "ring-2 ring-amber-400" : "",
    dimmed ? "opacity-40" : "",
    onClick && !faceOnly ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
    extraClass,
  ].join(" ");

  const faceRing =
    size === "river"
      ? "bg-white shadow-md ring-1 ring-stone-500/70"
      : "bg-white shadow-sm ring-1 ring-stone-300/80";
  const img = (
    <span
      className={`relative block overflow-hidden rounded-sm ${faceRing}`}
      style={{
        width: w,
        height: h,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      <Image
        src={TILE_IMAGE[tile]}
        alt={TILE_NAME_JA[tile]}
        width={w}
        height={h}
        className="h-full w-full object-contain"
        draggable={false}
        priority={size !== "xs" && size !== "river"}
      />
    </span>
  );

  const body = (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: boxW, height: boxH }}
    >
      {img}
    </span>
  );

  if (faceOnly || !onClick) {
    return (
      <span className={className} aria-label={TILE_NAME_JA[tile]}>
        {body}
        {recommended && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white whitespace-nowrap">
            推奨
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={TILE_NAME_JA[tile]}
      className={className}
    >
      {body}
      {recommended && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white whitespace-nowrap">
          推奨
        </span>
      )}
    </button>
  );
}
