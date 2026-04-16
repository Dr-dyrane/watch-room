export const DEFAULT_ROOM_ID = 'alex-jelo-room';

export const DEMO_INSTALL_STEPS = [
  'Download the extension folder or zip.',
  'Open chrome://extensions in Chrome.',
  'Turn on Developer mode in the top-right corner.',
  'Click Load unpacked and choose the extension folder.',
  'Open Netflix in another tab, then come back to this room page.',
];

export function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function getOrCreateSession() {
  if (typeof window === 'undefined') {
    return {
      id: 'server-session',
      name: 'You',
    };
  }

  const storageKey = 'watch-room-session';
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return JSON.parse(existing) as { id: string; name: string };
  }

  const created = {
    id: crypto.randomUUID(),
    name: 'You',
  };

  window.localStorage.setItem(storageKey, JSON.stringify(created));
  return created;
}
