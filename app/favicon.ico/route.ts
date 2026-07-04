const favicon = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#275d45"/>
    <path d="M15 29h34c0 13-7 21-17 21S15 42 15 29Z" fill="#fff4dc"/>
    <path d="M19 32h26c-2 8-6 13-13 13s-11-5-13-13Z" fill="#f3a712"/>
    <path d="M23 24c0-5 4-9 9-9s9 4 9 9" fill="none" stroke="#fff4dc" stroke-width="4" stroke-linecap="round"/>
    <circle cx="26" cy="34" r="3" fill="#4f8a55"/>
    <circle cx="37" cy="36" r="3" fill="#c94c35"/>
  </svg>
`;

export function GET() {
  return new Response(favicon, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
