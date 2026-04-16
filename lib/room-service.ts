import { createSupabaseAdminClient } from '@/lib/supabase';
import { getServerEnv } from '@/lib/server-env';
import { getPersonIdByName, PEOPLE } from '@/lib/watch-room';

const ONLINE_WINDOW_MS = 45_000;
const MAX_MESSAGE_LENGTH = 280;
const MAX_TITLE_LENGTH = 160;
const PLAYBACK_ACTIONS = new Set(['PLAY', 'PAUSE', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SYNC_NOW']);

type ParticipantRow = {
  session_id: string;
  name: string;
  role: 'host' | 'guest';
  is_ready: boolean;
  last_seen_at: string;
};

type ChatRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

type RoomRow = {
  id: string;
  slug: string;
  title: string;
  is_playing: boolean;
  playback_time: number;
  playback_updated_at: string;
  playback_updated_by: string | null;
  last_action: string | null;
};

function assertSecret(secret: string) {
  const serverEnv = getServerEnv();

  if (!/^\d{4}$/.test(serverEnv.roomSecret)) {
    throw new Error('Server passcode must be 4 digits.');
  }

  if (!/^\d{4}$/.test(secret)) {
    throw new Error('Passcode must be 4 digits.');
  }

  if (secret !== serverEnv.roomSecret) {
    throw new Error('Wrong passcode.');
  }
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function getRoomId() {
  const serverEnv = getServerEnv();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('rooms')
    .upsert(
      {
        slug: serverEnv.roomSlug,
        title: serverEnv.roomTitle,
      },
      {
        onConflict: 'slug',
      },
    )
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to resolve room.');
  }

  return data.id as string;
}

function normalizePersonName(name: string) {
  const profileId = getPersonIdByName(name);

  if (!profileId) {
    throw new Error('Unknown member.');
  }

  return PEOPLE[profileId];
}

function assertSessionId(sessionId: string) {
  if (typeof sessionId !== 'string' || sessionId.trim().length < 8) {
    throw new Error('Invalid session.');
  }
}

function normalizeMessageBody(body: string) {
  const normalized = body.trim();

  if (!normalized) {
    throw new Error('Message cannot be empty.');
  }

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

function normalizePlaybackAction(action: string) {
  if (!PLAYBACK_ACTIONS.has(action)) {
    throw new Error('Invalid playback action.');
  }

  return action;
}

function normalizePlaybackTime(currentTime: number) {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    throw new Error('Invalid playback time.');
  }

  return currentTime; // Keep as float for precision
}

function normalizePlaybackTitle(title?: string | null) {
  const normalized = title?.trim() || null;

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_TITLE_LENGTH);
}

async function resolveMemberRole(roomId: string, sessionId: string, name: string) {
  const supabase = createSupabaseAdminClient();
  const person = normalizePersonName(name);

  const { data: existingMember } = await supabase
    .from('room_participants')
    .select('role')
    .eq('room_id', roomId)
    .eq('session_id', sessionId)
    .maybeSingle();

  return existingMember?.role ?? person.role;
}

export async function joinRoom(input: {
  secret: string;
  sessionId: string;
  name: string;
}) {
  assertSecret(input.secret);
  assertSessionId(input.sessionId);
  const person = normalizePersonName(input.name);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();
  const role = await resolveMemberRole(roomId, input.sessionId, input.name);

  const { error } = await supabase.from('room_participants').upsert(
    {
      room_id: roomId,
      session_id: input.sessionId,
      name: person.name,
      role,
      last_seen_at: new Date().toISOString(),
    },
    {
      onConflict: 'room_id,session_id',
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return getRoomSnapshot({
    secret: input.secret,
    sessionId: input.sessionId,
    name: input.name,
  });
}

export async function getRoomSnapshot(input: {
  secret: string;
  sessionId: string;
  name: string;
}) {
  assertSecret(input.secret);
  assertSessionId(input.sessionId);
  const person = normalizePersonName(input.name);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const role = await resolveMemberRole(roomId, input.sessionId, input.name);

  const participantUpsert = supabase.from('room_participants').upsert(
    {
      room_id: roomId,
      session_id: input.sessionId,
      name: person.name,
      role,
      last_seen_at: now,
    },
    {
      onConflict: 'room_id,session_id',
      ignoreDuplicates: false,
    },
  );

  const participantsQuery = supabase
    .from('room_participants')
    .select('session_id,name,role,is_ready,last_seen_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  const chatQuery = supabase
    .from('room_chat')
    .select('id,sender,body,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(20);

  const roomQuery = supabase
    .from('rooms')
    .select('id,slug,title,is_playing,current_time,playback_updated_at,playback_updated_by,last_action')
    .eq('id', roomId)
    .single();

  const [participantUpsertResult, participantsResult, chatResult, roomResult] = await Promise.all([
    participantUpsert,
    participantsQuery,
    chatQuery,
    roomQuery,
  ]);

  if (participantUpsertResult.error) {
    throw new Error(participantUpsertResult.error.message);
  }

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (chatResult.error) {
    throw new Error(chatResult.error.message);
  }

  if (roomResult.error) {
    throw new Error(roomResult.error.message);
  }

  const participants = ((participantsResult.data ?? []) as ParticipantRow[]).map((p) => ({
    sessionId: p.session_id,
    name: p.name,
    role: p.role,
    ready: p.is_ready,
    online: Date.now() - new Date(p.last_seen_at).getTime() <= ONLINE_WINDOW_MS,
  }));

  const messages = ((chatResult.data ?? []) as ChatRow[])
    .reverse()
    .map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      time: formatMessageTime(m.created_at),
    }));

  const roomData = roomResult.data as RoomRow;
  const playback = {
    eventId: 0, // Legacy field, kept for type compatibility
    action: (roomData.last_action as any) || 'PAUSE',
    currentTime: roomData.playback_time,
    isPlaying: roomData.is_playing,
    title: roomData.title,
    sessionId: roomData.playback_updated_by || '',
    sender: participants.find(p => p.sessionId === roomData.playback_updated_by)?.name || 'Room',
    updatedAt: roomData.playback_updated_at,
  };

  const me = participants.find((p) => p.sessionId === input.sessionId) ?? null;
  const serverEnv = getServerEnv();

  return {
    room: {
      slug: serverEnv.roomSlug,
      title: serverEnv.roomTitle,
    },
    me,
    members: participants, // Keeping 'members' key for UI compatibility
    messages, // Keeping 'messages' key for UI compatibility
    playback,
  };
}

export async function setReadyState(input: {
  secret: string;
  sessionId: string;
  ready: boolean;
}) {
  assertSecret(input.secret);
  assertSessionId(input.sessionId);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('room_participants')
    .update({
      is_ready: input.ready,
      last_seen_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('session_id', input.sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendMessage(input: {
  secret: string;
  sessionId: string;
  sender: string;
  body: string;
}) {
  assertSecret(input.secret);
  assertSessionId(input.sessionId);
  const person = normalizePersonName(input.sender);
  const body = normalizeMessageBody(input.body);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('room_chat').insert({
    room_id: roomId,
    session_id: input.sessionId,
    sender: person.name,
    body,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendPlayback(input: {
  secret: string;
  sessionId: string;
  sender: string;
  action: 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'SYNC_NOW';
  currentTime: number;
  isPlaying: boolean;
  title?: string | null;
}) {
  assertSecret(input.secret);
  assertSessionId(input.sessionId);
  const action = normalizePlaybackAction(input.action);
  const playbackTime = normalizePlaybackTime(input.currentTime);
  const title = normalizePlaybackTitle(input.title);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  // Authoritative update directly on the rooms table
  const { error } = await supabase
    .from('rooms')
    .update({
      is_playing: input.isPlaying,
      playback_time: playbackTime,
      playback_updated_at: new Date().toISOString(),
      playback_updated_by: input.sessionId,
      last_action: action,
      title: title || undefined, // Only update if provided
    })
    .eq('id', roomId);

  if (error) {
    throw new Error(error.message);
  }
}

