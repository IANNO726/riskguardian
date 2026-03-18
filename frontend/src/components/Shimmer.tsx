import React from "react";

export default function Shimmer({
  height = 20,
  radius = 8
}: {
  height?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, #131842 25%, #1c245e 50%, #131842 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite"
      }}
    />
  );
}

