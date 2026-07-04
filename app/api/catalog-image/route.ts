const escapeXml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character];
  });

const toLabel = (keywords: string) =>
  keywords
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" & ");

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") ?? "local,meal";
  const parsedLock = Number.parseInt(searchParams.get("lock") ?? "0", 10);
  const lock = Number.isFinite(parsedLock) ? Math.abs(parsedLock) : 0;
  const hue = lock % 360;
  const accentHue = (hue + 42) % 360;
  const label = escapeXml(toLabel(keywords) || "Local Meal");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 52% 30%)"/>
          <stop offset="1" stop-color="hsl(${accentHue} 68% 48%)"/>
        </linearGradient>
        <radialGradient id="plate" cx="50%" cy="45%" r="55%">
          <stop offset="0" stop-color="#fffdf5"/>
          <stop offset="1" stop-color="#eadfca"/>
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#background)"/>
      <circle cx="354" cy="44" r="80" fill="#ffffff" opacity="0.08"/>
      <circle cx="42" cy="270" r="105" fill="#000000" opacity="0.08"/>
      <g transform="translate(200 122)">
        <ellipse cx="0" cy="10" rx="91" ry="67" fill="#000000" opacity="0.2"/>
        <ellipse cx="0" cy="0" rx="91" ry="67" fill="url(#plate)"/>
        <ellipse cx="0" cy="0" rx="64" ry="43" fill="hsl(${accentHue} 65% 64%)"/>
        <path d="M-48 10c22-35 75-37 99-4-24 27-74 31-99 4Z" fill="hsl(${hue} 58% 38%)"/>
        <circle cx="-20" cy="-7" r="11" fill="#f2c14e"/>
        <circle cx="12" cy="12" r="13" fill="#66a94f"/>
        <circle cx="35" cy="-10" r="9" fill="#d95d39"/>
      </g>
      <text x="200" y="226" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="23" font-weight="700">${label}</text>
      <text x="200" y="253" text-anchor="middle" fill="#ffffff" opacity="0.82" font-family="Arial, sans-serif" font-size="13" letter-spacing="1.8">KIBANDA EXPRESS</text>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
