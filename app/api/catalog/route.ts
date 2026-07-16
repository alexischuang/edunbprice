import { NextResponse } from "next/server";
import {
  clearCatalogState,
  getCatalogState,
  importCatalogFromExcel,
  importCatalogPhotos,
  summarizeCatalog,
} from "@/app/catalog-service";
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "upload");

    if (action === "clear") {
      const state = await clearCatalogState();
      return NextResponse.json({
        ok: true,
        action,
        state,
      });
    }

    if (action === "photos") {
      const photoFiles = formData
        .getAll("photos")
        .filter((value): value is File => value instanceof File);

      if (!photoFiles.length) {
        return NextResponse.json({ ok: false, error: "請先選擇照片。" }, { status: 400 });
      }

      const state = await importCatalogPhotos(photoFiles);
      return NextResponse.json({
        ok: true,
        action,
        state,
        summary: summarizeCatalog(state, fallbackLaptops),
      });
    }

    const fileValue = formData.get("excel");
    if (!(fileValue instanceof File)) {
      return NextResponse.json({ ok: false, error: "請先選擇 Excel 檔。" }, { status: 400 });
    }

    const state = await importCatalogFromExcel(fileValue);
    return NextResponse.json({
      ok: true,
      action,
      state,
      summary: summarizeCatalog(state, fallbackLaptops),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    const storageMissing = message.includes("Vercel KV");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        storageStatus: storageMissing ? "missing" : undefined,
      },
      { status: storageMissing ? 503 : 500 },
    );
  }
}
