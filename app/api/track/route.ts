export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, sessionId, propertyId, propertyName, propertyAddress, cityName, country } = body;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const ua = request.headers.get("user-agent") ?? "unknown";
    const ts = new Date().toISOString();

    // Everything here is attacker-controlled (body fields and headers), so
    // strip newlines from all of it — not just some fields — to prevent log
    // forging, and cap lengths so one request can't flood a log line.
    const sanitize = (value: unknown, max = 160) =>
      String(value).replace(/[\r\n]/g, " ").trim().slice(0, max);

    const parts = [
      `[${ts}]`,
      `ip=${sanitize(ip, 64)}`,
      `session=${sessionId ? sanitize(sessionId, 64) : "?"}`,
      `event=${sanitize(event, 64)}`,
    ];

    if (propertyName) parts.push(`property="${sanitize(propertyName)}"`);
    if (propertyId) parts.push(`id=${sanitize(propertyId, 64)}`);
    if (cityName) parts.push(`city="${sanitize(cityName)}"`);
    if (country) parts.push(`country="${sanitize(country)}"`);
    if (propertyAddress) parts.push(`addr="${sanitize(propertyAddress)}"`);
    if (ua && ua !== "unknown") parts.push(`ua="${sanitize(ua, 80)}"`);

    console.log("[track]", parts.join(" | "));
  } catch {
    // swallow — tracking must not break the app
  }

  return new Response(null, { status: 204 });
}
