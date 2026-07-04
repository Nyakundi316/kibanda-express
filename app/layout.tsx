import type { Metadata } from "next";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import ConvexClientProvider from "@/components/ConvexClientProvider";

export const metadata: Metadata = {
  title: "Kibanda Express",
  description: "Order local meals from vendors near you in Nairobi.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body-md text-body-md selection:bg-primary-fixed selection:text-on-primary-fixed">
        <ConvexClientProvider>
          <SplashScreen />
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
