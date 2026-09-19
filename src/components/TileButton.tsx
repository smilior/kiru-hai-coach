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
  river: { w: 16, h: 22 },
  sm: { w: 32, h: 44 },
  hand: { w: 28, h: 40 },
  md: { w: 48, h: 64 },
  lg: { w: 56, h: 76 },
};

function rotClass(rotate: 0 | 90 | -90 | 180): string {
  if (rotate === 90) return "tile-rot-90";
  if (rotate === -90) return "tile-rot-neg90";
  if (rotate === 180) return "tile-rot-180";
  return "tile-rot-0";
}

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
    "relative shrink-0 rounded-md touch-manipulation",
    size !== "river" ? "transition-transform" : "",
    !faceOnly && onClick ? "active:scale-95" : "",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
    showGlow ? "-translate-y-1.5 ring-2 ring-amber-300/90" : "",
    recommended && !showGlow ? "ring-2 ring-emerald-500 -translate-y-1" : "",
    highlighted && !showGlow ? "ring-2 ring-amber-400" : "",
    dimmed ? "opacity-40" : "",
    onClick && !faceOnly ? "cursor-pointer hover:-translate-y-1" : "cursor-default",
    extraClass,
  ].join(" ");

  // Rivers: plain <img> + CSS rotate class (Next/Image + inline transform was a no-op in prod QA).
  if (size === "river") {
    const face = (
      <span
        className={`tile-rot-box ${rotClass(rotate)}`}
        style={{ width: boxW, height: boxH }}
        data-rotate={rotate}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TILE_IMAGE[tile]}
          alt={TILE_NAME_JA[tile]}
          width={w}
          height={h}
          draggable={false}
          className="tile-rot-face bg-white shadow-md ring-1 ring-stone-500/70 rounded-sm"
          style={{ width: w, height: h }}
        />
      </span>
    );
    if (faceOnly || !onClick) {
      return (
        <span className={className} aria-label={TILE_NAME_JA[tile]}>
          {face}
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
        {face}
      </button>
    );
  }

  const faceRing = "bg-white shadow-sm ring-1 ring-stone-300/80";
  const img = (
    <span
      className={`relative block overflow-hidden rounded-sm ${faceRing}`}
      style={{ width: w, height: h }}
    >
      <Image
        src={TILE_IMAGE[tile]}
        alt={TILE_NAME_JA[tile]}
        width={w}
        height={h}
        className="h-full w-full object-contain"
        draggable={false}
        priority={size !== "xs"}
      />
    </span>
  );

  const body = (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: w, height: h }}
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
