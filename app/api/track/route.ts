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

    const sanitize = (str: string) => str.replace(/[\r\n]/g, " ").trim();

    const parts = [
      `[${ts}]`,
      `ip=${ip}`,
      `session=${sessionId ?? "?"}`,
      `event=${event}`,
    ];

    if (propertyName) parts.push(`property="${sanitize(propertyName)}"`);
    if (propertyId) parts.push(`id=${propertyId}`);
    if (cityName) parts.push(`city="${sanitize(cityName)}"`);
    if (country) parts.push(`country="${sanitize(country)}"`);
    if (propertyAddress) parts.push(`addr="${sanitize(propertyAddress)}"`);
    if (ua && ua !== "unknown") parts.push(`ua="${ua.slice(0, 80).replace(/[\r\n]/g, " ").trim()}"`);

    console.log("[track]", parts.join(" | "));
  } catch {
    // swallow — tracking must not break the app
  }

  return new Response(null, { status: 204 });
}
