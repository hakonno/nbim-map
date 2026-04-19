"use client";

import dynamic from "next/dynamic";

import type { CityNode } from "@/types/cities";

const CityMapInner = dynamic(() => import("./CityMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100svh] w-full items-center justify-center bg-slate-100 text-slate-700">
      Loading city investment map...
    </div>
  ),
});

type CityMapProps = {
  cities: CityNode[];
};

export default function CityMap({ cities }: CityMapProps) {
  return <CityMapInner cities={cities} />;
}
