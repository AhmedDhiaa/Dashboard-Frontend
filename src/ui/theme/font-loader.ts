import localFont from "next/font/local"

export const fontSans = localFont({
  src: [
    {
      path: "../../../public/fonts/inter-variable.woff2",
      weight: "100 900", // Map as variable font range
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
})

export const fontMono = localFont({
  src: [
    {
      path: "../../../public/fonts/jetbrains-mono-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
})

export const fontArabic = localFont({
  src: [
    {
      path: "../../../public/fonts/ibm-plex-arabic-100.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-200.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/ibm-plex-arabic-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-arabic",
  display: "swap",
})
