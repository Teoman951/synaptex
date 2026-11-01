"use client";

import dynamic from "next/dynamic";

// The language comes from the viewer's device, so nothing is prerendered.
const Workspace = dynamic(
  () => import("@/components/layout/Workspace").then((module) => module.Workspace),
  { ssr: false },
);

export default function Home() {
  return <Workspace />;
}
