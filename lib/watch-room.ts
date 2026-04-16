export const DEFAULT_ROOM_ID = 'watch-room';

export const PEOPLE = {
  dyrane: {
    id: 'dyrane',
    name: 'Dyrane',
    city: 'Hemet, US',
    role: 'host' as const,
    avatar: 'D',
    timeZones: ['America/Los_Angeles'],
    locales: ['en-US'],
  },
  jelo: {
    id: 'jelo',
    name: 'Jelo',
    city: 'Lagos, Nigeria',
    role: 'guest' as const,
    avatar: 'J',
    timeZones: ['Africa/Lagos'],
    locales: ['en-NG'],
  },
};

export type PersonId = keyof typeof PEOPLE;
export type PlaybackAction = 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'SYNC_NOW';

export type RoomSnapshot = {
  room: {
    slug: string;
    title: string;
  };
  me: {
    sessionId: string;
    name: string;
    role: 'host' | 'guest';
    ready: boolean;
    online: boolean;
  } | null;
  members: Array<{
    sessionId: string;
    name: string;
    role: 'host' | 'guest';
    ready: boolean;
    online: boolean;
  }>;
  messages: Array<{
    id: string;
    sender: string;
    body: string;
    time: string;
  }>;
  playback: {
    eventId: number;
    action: PlaybackAction;
    currentTime: number;
    isPlaying: boolean;
    title: string | null;
    sessionId: string;
    sender: string;
    updatedAt: string;
  } | null;
};

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
      name: PEOPLE.dyrane.name,
    };
  }

  const storageKey = 'watch-room-session';
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return JSON.parse(existing) as { id: string; name: string };
  }

  const created = {
    id: crypto.randomUUID(),
    name: PEOPLE.dyrane.name,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(created));
  return created;
}

export function updateSessionName(name: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = 'watch-room-session';
  const existing = getOrCreateSession();
  window.localStorage.setItem(storageKey, JSON.stringify({ ...existing, name }));
}

export function getStoredRoomSecret() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem('watch-room-secret') ?? '';
}

export function setStoredRoomSecret(secret: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('watch-room-secret', secret);
}

export function getStoredProfileId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem('watch-room-profile');
  return value === 'dyrane' || value === 'jelo' ? value : null;
}

export function setStoredProfileId(profileId: PersonId) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('watch-room-profile', profileId);
}

export function detectProfile(): PersonId | null {
  if (typeof window === 'undefined') {
    return 'dyrane';
  }

  const stored = getStoredProfileId();
  if (stored) {
    return stored;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (PEOPLE.jelo.timeZones.includes(timeZone)) {
    return 'jelo';
  }

  if (PEOPLE.dyrane.timeZones.includes(timeZone)) {
    return 'dyrane';
  }

  const language = navigator.language;
  if (PEOPLE.jelo.locales.includes(language)) {
    return 'jelo';
  }

  if (PEOPLE.dyrane.locales.includes(language)) {
    return 'dyrane';
  }

  return 'dyrane';
}

export function getPerson(profileId: PersonId) {
  return PEOPLE[profileId];
}

export function getPersonIdByName(name: string): PersonId | null {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'dyrane') {
    return 'dyrane';
  }

  if (normalized === 'jelo') {
    return 'jelo';
  }

  return null;
}
