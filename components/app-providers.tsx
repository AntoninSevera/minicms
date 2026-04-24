"use client";

import { SessionProvider } from "next-auth/react";
import { Analytics } from "./analytics";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Analytics />
    </SessionProvider>
  );
}
