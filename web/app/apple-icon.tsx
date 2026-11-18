import { ImageResponse } from "next/og";

import { WALL, markDataUri } from "@/lib/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The app icon: the spanner over the job card, on the charcoal of the pegboard.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: WALL }}>
        <img src={markDataUri()} width={150} height={150} alt="" />
      </div>
    ),
    size,
  );
}
