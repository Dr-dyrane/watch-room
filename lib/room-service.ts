import { createSupabaseAdminClient } from '@/lib/supabase';
import { getServerEnv } from '@/lib/server-env';
import { getPersonIdByName, PEOPLE } from '@/lib/watch-room';

const ONLINE_WINDOW_MS = 45_000;

type MemberRow = {
  session_id: string;
  name: string;
  role: 'host' | 'guest';
  is_ready: boolean;
  last_seen_at: string;
};

type MessageRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

type PlaybackStateRow = {
  event_id: number;
  action: 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'SYNC_NOW';
  playback_time: number;
  is_playing: boolean;
  title: string | null;
  session_id: string;
  sender: string;
  updated_at: string;
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

async function resolveMemberRole(roomId: string, sessionId: string, name: string) {
  const supabase = createSupabaseAdminClient();
  const person = normalizePersonName(name);

  const { data: existingMember } = await supabase
    .from('room_members')
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
  const person = normalizePersonName(input.name);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();
  const role = await resolveMemberRole(roomId, input.sessionId, input.name);

  const { error } = await supabase.from('room_members').upsert(
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
  const person = normalizePersonName(input.name);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const role = await resolveMemberRole(roomId, input.sessionId, input.name);

  const memberUpsert = supabase.from('room_members').upsert(
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

  const membersQuery = supabase
    .from('room_members')
    .select('session_id,name,role,is_ready,last_seen_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  const messagesQuery = supabase
    .from('room_messages')
    .select('id,sender,body,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(20);

  const playbackQuery = supabase
    .from('room_playback_state')
    .select('event_id,action,playback_time,is_playing,title,session_id,sender,updated_at')
    .eq('room_id', roomId)
    .maybeSingle();

  const [memberUpsertResult, membersResult, messagesResult, playbackResult] = await Promise.all([
    memberUpsert,
    membersQuery,
    messagesQuery,
    playbackQuery,
  ]);

  if (memberUpsertResult.error) {
    throw new Error(memberUpsertResult.error.message);
  }

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  if (playbackResult.error) {
    throw new Error(playbackResult.error.message);
  }

  const members = ((membersResult.data ?? []) as MemberRow[]).map((member) => ({
    sessionId: member.session_id,
    name: member.name,
    role: member.role,
    ready: member.is_ready,
    online: Date.now() - new Date(member.last_seen_at).getTime() <= ONLINE_WINDOW_MS,
  }));

  const messages = ((messagesResult.data ?? []) as MessageRow[])
    .reverse()
    .map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      time: formatMessageTime(message.created_at),
    }));

  const playback = playbackResult.data
    ? {
        eventId: (playbackResult.data as PlaybackStateRow).event_id,
        action: (playbackResult.data as PlaybackStateRow).action,
        currentTime: (playbackResult.data as PlaybackStateRow).playback_time,
        isPlaying: (playbackResult.data as PlaybackStateRow).is_playing,
        title: (playbackResult.data as PlaybackStateRow).title,
        sessionId: (playbackResult.data as PlaybackStateRow).session_id,
        sender: (playbackResult.data as PlaybackStateRow).sender,
        updatedAt: (playbackResult.data as PlaybackStateRow).updated_at,
      }
    : null;

  const me = members.find((member) => member.sessionId === input.sessionId) ?? null;
  const serverEnv = getServerEnv();

  return {
    room: {
      slug: serverEnv.roomSlug,
      title: serverEnv.roomTitle,
    },
    me,
    members,
    messages,
    playback,
  };
}

export async function setReadyState(input: {
  secret: string;
  sessionId: string;
  ready: boolean;
}) {
  assertSecret(input.secret);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('room_members')
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
  const person = normalizePersonName(input.sender);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('room_messages').insert({
    room_id: roomId,
    session_id: input.sessionId,
    sender: person.name,
    body: input.body.trim(),
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
  const person = normalizePersonName(input.sender);
  const roomId = await getRoomId();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('room_playback_events')
    .insert({
      room_id: roomId,
      session_id: input.sessionId,
      sender: person.name,
      action: input.action,
      playback_time: Math.max(0, Math.floor(input.currentTime)),
      title: input.title?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to create playback event.');
  }

  const { error: stateError } = await supabase.from('room_playback_state').upsert(
    {
      room_id: roomId,
      event_id: data.id,
      session_id: input.sessionId,
      sender: person.name,
      action: input.action,
      playback_time: Math.max(0, Math.floor(input.currentTime)),
      is_playing: input.isPlaying,
      title: input.title?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'room_id',
    },
  );

  if (stateError) {
    throw new Error(stateError.message);
  }
}
