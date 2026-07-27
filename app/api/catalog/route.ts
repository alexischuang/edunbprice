import { NextResponse } from "next/server";
import { getCatalogState, summarizeCatalog } from "@/app/catalog-service";
import { laptops as fallbackLaptops } from "@/app/laptop-data";

export const runtime = "nodejs";

export async function GET() {
  const catalog = await getCatalogState();
  const summary = summarizeCatalog(catalog, fallbackLaptops);
  return NextResponse.json({
    ...catalog,
    ...summary,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Updating catalog data has been disabled.",
    },
    { status: 405 },
  );
}
