'use client';

import { MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <IconButton
      aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
      variant="soft"
      size="3"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <SunIcon width="18" height="18" /> : <MoonIcon width="18" height="18" />}
    </IconButton>
  );
}
