import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AmplitudeProvider from "@/components/AmplitudeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "닥터원츠 GEO 프로그램 - AI 검색 점유율 스캐너",
  description: "마케팅 대행사용 치과 AI 검색 점유율(SOV) 스캐너. 실제 롱테일 키워드 기반으로 노출 상태를 정확히 측정하세요.",
  keywords: "치과 마케팅, AI 검색 점유율, 병원 마케팅 대행, Share of Voice, SOV 분석",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmplitudeProvider>{children}</AmplitudeProvider>
      </body>
    </html>
  );
}
