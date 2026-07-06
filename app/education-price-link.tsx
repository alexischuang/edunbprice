"use client";

const LINE_OFFICIAL_URL = "https://lin.ee/Y9sCx0K";

export function EducationPriceLink({
  showEducationPrice,
  priceText,
}: {
  showEducationPrice: boolean;
  priceText: string;
}) {
  if (showEducationPrice) {
    return <>{priceText}</>;
  }

  return (
    <a
      href={LINE_OFFICIAL_URL}
      className="edu edu-link"
      rel="noreferrer"
      target="_blank"
      title="聯絡 LINE 官方帳號"
    >
      {priceText}
    </a>
  );
}
