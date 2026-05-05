import attomDataRaw from "@/data/attom-data.json";

const attomData = attomDataRaw as Record<string, unknown>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const entry = Object.prototype.hasOwnProperty.call(attomData, id) ? attomData[id] : undefined;

  return Response.json(entry ?? null, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
