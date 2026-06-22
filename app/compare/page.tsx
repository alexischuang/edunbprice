import { Suspense } from "react";
import CompareClient from "./compare-client";

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="page-frame">載入比較頁中...</div>}>
      <CompareClient />
    </Suspense>
  );
}

