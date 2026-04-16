'use client';

import { Theme } from '@radix-ui/themes';
import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <RadixThemeBridge>{children}</RadixThemeBridge>
    </ThemeProvider>
  );
}

function RadixThemeBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Theme
      appearance={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
      accentColor="gray"
      grayColor="slate"
      radius="large"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}
