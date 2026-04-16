'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Strong,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  CopyIcon,
  Cross2Icon,
  PaperPlaneIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from '@radix-ui/react-icons';
import { LockKeyhole, MapPin, MessageCircleMore, Sparkles, Tv, Users2 } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { getPublicRoomConfig } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  detectProfile,
  formatTime,
  getOrCreateSession,
  getPerson,
  getStoredProfileId,
  getStoredRoomSecret,
  setStoredProfileId,
  setStoredRoomSecret,
  updateSessionName,
  type PersonId,
  type PlaybackAction,
  type RoomSnapshot,
} from '@/lib/watch-room';

type PanelType = 'people' | 'chat' | 'access' | null;

export default function Page() {
  const session = useMemo(() => getOrCreateSession(), []);
  const roomConfig = getPublicRoomConfig();
  const detectedProfileId = useMemo(() => detectProfile(), []);
  const initialProfileId = getStoredProfileId() ?? detectedProfileId ?? 'dyrane';
  const [profileId, setProfileId] = useState<PersonId>(initialProfileId);
  const [activeProfileId, setActiveProfileId] = useState<PersonId>(initialProfileId);
  const [passcode, setPasscode] = useState(getStoredRoomSecret());
  const [activePasscode, setActivePasscode] = useState(getStoredRoomSecret());
  const [draftMessage, setDraftMessage] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [presenceSessionIds, setPresenceSessionIds] = useState<string[]>([]);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [extensionError, setExtensionError] = useState('');
  const [extensionState, setExtensionState] = useState({ title: '', currentTime: 0, paused: true });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<PanelType>(null);
  const [joining, startJoining] = useTransition();
  const [sending, startSending] = useTransition();
  const appliedEventId = useRef<number>(0);
  const refreshSnapshotRef = useRef<(() => Promise<void>) | null>(null);
  const persistPlaybackRef = useRef<(action: PlaybackAction, currentTime: number) => Promise<void>>(async () => {});

  const activePerson = getPerson(activeProfileId);
  const selectedPerson = getPerson(profileId);
  const currentTitle = snapshot?.playback?.title || extensionState.title || roomConfig.roomTitle;
  const lastMessage = snapshot?.messages.at(-1);

  const members = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const onlineIds = new Set(presenceSessionIds);
    return snapshot.members.map((member) => ({
      ...member,
      online: onlineIds.size > 0 ? onlineIds.has(member.sessionId) : member.online,
    }));
  }, [presenceSessionIds, snapshot]);

  const onlineCount = members.filter((member) => member.online).length;

  useEffect(() => {
    updateSessionName(selectedPerson.name);
  }, [selectedPerson.name]);

  useEffect(() => {
    const pingExtension = () => {
      window.postMessage({ source: 'watch-room-app', type: 'PING_EXTENSION' }, '*');
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'watch-room-extension') {
        return;
      }

      if (event.data.type === 'EXTENSION_READY') {
        setExtensionConnected(true);
        setExtensionError('');
      }

      if (event.data.type === 'NETFLIX_STATE') {
        setExtensionState({
          title: typeof event.data.title === 'string' ? event.data.title : '',
          currentTime: typeof event.data.currentTime === 'number' ? Math.floor(event.data.currentTime) : 0,
          paused: typeof event.data.paused === 'boolean' ? event.data.paused : true,
        });
      }

      if (event.data.type === 'EXTENSION_ERROR') {
        setExtensionError(typeof event.data.message === 'string' ? event.data.message : 'Netflix bridge unavailable');
      }

      if (event.data.type === 'OVERLAY_CONTROL' && activePasscode) {
        const action = event.data.action as PlaybackAction | undefined;
        const currentTime =
          typeof event.data.currentTime === 'number' ? event.data.currentTime : extensionState.currentTime;

        if (!action) {
          return;
        }

        startSending(async () => {
          await persistPlaybackRef.current(action, currentTime);
        });
      }
    };

    window.addEventListener('message', onMessage);
    pingExtension();
    const intervalId = window.setInterval(pingExtension, 3000);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('message', onMessage);
    };
  }, [activePasscode, extensionState.currentTime, startSending]);

  useEffect(() => {
    if (!snapshot?.playback) {
      return;
    }

    if (snapshot.playback.eventId <= appliedEventId.current) {
      return;
    }

    appliedEventId.current = snapshot.playback.eventId;

    if (snapshot.playback.sessionId === session.id) {
      return;
    }

    window.postMessage(
      {
        source: 'watch-room-app',
        type: 'APP_CONTROL',
        payload: {
          action: snapshot.playback.action,
          currentTime: snapshot.playback.currentTime,
        },
      },
      '*',
    );
  }, [session.id, snapshot?.playback]);

  useEffect(() => {
    if (!activePasscode) {
      return;
    }

    let cancelled = false;

    const syncSnapshot = async (endpoint: '/api/room/bootstrap' | '/api/room/snapshot') => {
      try {
        const nextSnapshot = await postJson<RoomSnapshot>(endpoint, {
          secret: activePasscode,
          sessionId: session.id,
          name: activePerson.name,
        });

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError('');
        }
      } catch (syncError) {
        if (!cancelled) {
          setSnapshot(null);
          setError(syncError instanceof Error ? syncError.message : 'Unable to reach the room.');
        }
      }
    };

    refreshSnapshotRef.current = async () => {
      await syncSnapshot('/api/room/snapshot');
    };

    void syncSnapshot('/api/room/bootstrap');

    return () => {
      cancelled = true;
      refreshSnapshotRef.current = null;
    };
  }, [activePasscode, activePerson.name, session.id]);

  useEffect(() => {
    if (!activePasscode) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    let refreshTimeout: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        refreshSnapshotRef.current?.();
      }, 120);
    };

    const updatePresence = () => {
      const state = channel.presenceState();
      const onlineIds: string[] = [];

      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          const sessionId =
            typeof entry === 'object' &&
            entry !== null &&
            'sessionId' in entry &&
            typeof entry.sessionId === 'string'
              ? entry.sessionId
              : null;

          if (sessionId) {
            onlineIds.push(sessionId);
          }
        });
      });

      setPresenceSessionIds(Array.from(new Set(onlineIds)));
    };

    const channel = supabase
      .channel(`watch-room-realtime:${roomConfig.roomSlug}`, {
        config: {
          presence: {
            key: session.id,
          },
        },
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_playback_events' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_playback_state' }, scheduleRefresh)
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, updatePresence)
      .on('presence', { event: 'leave' }, updatePresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            sessionId: session.id,
            name: activePerson.name,
            room: roomConfig.roomSlug,
          });
          updatePresence();
          refreshSnapshotRef.current?.();
        }
      });

    return () => {
      if (refreshTimeout) {
        window.clearTimeout(refreshTimeout);
      }

      setPresenceSessionIds([]);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [activePasscode, activePerson.name, roomConfig.roomSlug, session.id]);

  useEffect(() => {
    persistPlaybackRef.current = async (action: PlaybackAction, currentTime: number) => {
      await postJson('/api/room/playback', {
        secret: activePasscode,
        sessionId: session.id,
        sender: activePerson.name,
        action,
        currentTime,
        isPlaying: action === 'PLAY' ? true : action === 'PAUSE' ? false : !extensionState.paused,
        title: extensionState.title || snapshot?.playback?.title || null,
      });

      const nextSnapshot = await postJson<RoomSnapshot>('/api/room/snapshot', {
        secret: activePasscode,
        sessionId: session.id,
        name: activePerson.name,
      });

      setSnapshot(nextSnapshot);
    };
  }, [
    activePasscode,
    activePerson.name,
    extensionState.paused,
    extensionState.title,
    session.id,
    snapshot?.playback?.title,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    window.postMessage(
      {
        source: 'watch-room-app',
        type: 'ROOM_CONTEXT_UPDATE',
        payload: {
          title: currentTitle,
          subtitle: snapshot ? `${activePerson.name} in room · ${onlineCount} online` : `Welcome ${selectedPerson.name}`,
          members: members.map((member) => ({
            name: member.name,
            online: member.online,
            ready: member.ready,
          })),
        },
      },
      '*',
    );
  }, [activePerson.name, currentTitle, members, onlineCount, selectedPerson.name, snapshot]);

  const submitJoin = () => {
    if (passcode.length !== 4) {
      setError('Passcode must be 4 digits.');
      return;
    }

    startJoining(async () => {
      try {
        const nextSnapshot = await postJson<RoomSnapshot>('/api/room/bootstrap', {
          secret: passcode,
          sessionId: session.id,
          name: selectedPerson.name,
        });

        setActiveProfileId(profileId);
        setActivePasscode(passcode);
        setStoredProfileId(profileId);
        setStoredRoomSecret(passcode);
        updateSessionName(selectedPerson.name);
        setSnapshot(nextSnapshot);
        setError('');
        setPanel(null);
      } catch (joinError) {
        setSnapshot(null);
        setError(joinError instanceof Error ? joinError.message : 'Unable to join room.');
      }
    });
  };

  const toggleReady = () => {
    const currentMe = snapshot?.me;

    if (!currentMe) {
      return;
    }

    startSending(async () => {
      await postJson('/api/room/ready', {
        secret: activePasscode,
        sessionId: session.id,
        ready: !currentMe.ready,
      });

      const nextSnapshot = await postJson<RoomSnapshot>('/api/room/snapshot', {
        secret: activePasscode,
        sessionId: session.id,
        name: activePerson.name,
      });

      setSnapshot(nextSnapshot);
    });
  };

  const sendMessage = () => {
    const body = draftMessage.trim();

    if (!body) {
      return;
    }

    startSending(async () => {
      await postJson('/api/room/messages', {
        secret: activePasscode,
        sessionId: session.id,
        sender: activePerson.name,
        body,
      });

      setDraftMessage('');

      const nextSnapshot = await postJson<RoomSnapshot>('/api/room/snapshot', {
        secret: activePasscode,
        sessionId: session.id,
        name: activePerson.name,
      });

      setSnapshot(nextSnapshot);
    });
  };

  const sendPlayback = (action: PlaybackAction) => {
    startSending(async () => {
      const currentTime =
        action === 'SEEK_FORWARD'
          ? extensionState.currentTime + 10
          : action === 'SEEK_BACKWARD'
            ? Math.max(0, extensionState.currentTime - 10)
            : extensionState.currentTime;

      window.postMessage(
        {
          source: 'watch-room-app',
          type: 'APP_CONTROL',
          payload: {
            action,
            currentTime,
          },
        },
        '*',
      );

      await persistPlaybackRef.current(action, currentTime);
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}?room=${roomConfig.roomSlug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const openNetflix = () => {
    window.postMessage({ source: 'watch-room-app', type: 'OPEN_NETFLIX' }, '*');
  };

  const readyLabel = snapshot?.me?.ready ? 'Ready' : 'Waiting';
  const bridgeLabel = extensionConnected ? 'Bridge live' : 'Bridge idle';

  return (
    <main className="canvas-shell">
      <div className="cinema-stage">
        <Flex direction="column" gap="5">
          <Flex className="top-bar" align="start" justify="between" gap="4" wrap="wrap">
            <Box>
              <Text size="1" weight="medium" className="canvas-kicker">
                Private room
              </Text>
              <Heading size="9" className="canvas-title">
                {snapshot ? currentTitle : `Welcome ${selectedPerson.name}`}
              </Heading>
              <Text size="3" color="gray" className="canvas-subtitle">
                {snapshot ? `${activePerson.city} · ${activePerson.role}` : `${selectedPerson.city} · passcode?`}
              </Text>
            </Box>

            <Flex gap="2" wrap="wrap" align="center">
              <StatusChip active={Boolean(snapshot)} label={snapshot ? 'Inside' : 'Locked'} />
              <StatusChip active={extensionConnected} label={bridgeLabel} />
              <Button size="3" variant="soft" className="surface-button" onClick={copyLink}>
                <CopyIcon />
                {copied ? 'Copied' : 'Invite'}
              </Button>
              <Button size="3" variant="soft" className="surface-button" onClick={openNetflix}>
                Open Netflix
              </Button>
              <ThemeToggle />
            </Flex>
          </Flex>

          <div className="cinema-grid">
            <Card size="5" className="hero-surface surface-level-hero">
              <Flex direction="column" justify="between" height="100%" gap="5">
                <Flex justify="between" align="start" gap="3" wrap="wrap" className="panel-header">
                  <Flex direction="column" gap="2">
                    <Badge size="2" radius="full" variant="surface" className="soft-chip">
                      {roomConfig.roomTitle}
                    </Badge>
                    <Heading size="8" className="hero-heading">
                      {snapshot ? currentTitle : `Welcome ${selectedPerson.name}`}
                    </Heading>
                    <Text size="3" color="gray" className="hero-copy">
                      {snapshot
                        ? extensionError || (extensionConnected ? 'Your cinema controls are connected.' : 'Open Netflix to bring the room to life.')
                        : detectedProfileId === profileId
                          ? 'Detected from this device.'
                          : 'Adjusted manually for this screen.'}
                    </Text>
                  </Flex>

                  <Flex gap="2" wrap="wrap">
                    <InfoPill icon={<MapPin size={14} />} label={selectedPerson.city} />
                    <InfoPill icon={<Sparkles size={14} />} label={readyLabel} />
                    <InfoPill icon={<Users2 size={14} />} label={`${onlineCount} online`} />
                  </Flex>
                </Flex>

                <Box className="focus-stage">
                  <div className="focus-halo" />
                  <Text as="p" className="focus-time">
                    {formatTime(extensionState.currentTime || snapshot?.playback?.currentTime || 0)}
                  </Text>
                </Box>

                {snapshot ? (
                  <Flex direction="column" gap="4" className="hero-control-block">
                    <Flex align="center" justify="center" gap="3" wrap="wrap">
                      <IconButton size="4" radius="full" variant="soft" className="flow-button" onClick={() => sendPlayback('SEEK_BACKWARD')} disabled={sending} aria-label="Seek backward">
                        <TrackPreviousIcon width="22" height="22" />
                      </IconButton>
                      <IconButton size="4" radius="full" variant="solid" className="flow-button flow-button-primary" onClick={() => sendPlayback(extensionState.paused ? 'PLAY' : 'PAUSE')} disabled={sending} aria-label={extensionState.paused ? 'Play together' : 'Pause together'}>
                        {extensionState.paused ? <PlayIcon width="24" height="24" /> : <PauseIcon width="24" height="24" />}
                      </IconButton>
                      <IconButton size="4" radius="full" variant="soft" className="flow-button" onClick={() => sendPlayback('SEEK_FORWARD')} disabled={sending} aria-label="Seek forward">
                        <TrackNextIcon width="22" height="22" />
                      </IconButton>
                      <IconButton size="4" radius="full" variant="soft" className="flow-button" onClick={() => sendPlayback('SYNC_NOW')} disabled={sending} aria-label="Sync now">
                        <ReloadIcon width="22" height="22" />
                      </IconButton>
                    </Flex>

                    <Flex gap="3" wrap="wrap" justify="center">
                      <ActionPill label={extensionState.paused ? 'Paused' : 'Playing'} />
                      <ActionPill label={snapshot?.me?.role ?? activePerson.role} />
                      <ActionPill label={onlineCount > 1 ? 'Together' : 'Solo control'} />
                    </Flex>
                  </Flex>
                ) : (
                  <GateSurface
                    detectedProfileId={detectedProfileId}
                    error={error}
                    joining={joining}
                    passcode={passcode}
                    profileId={profileId}
                    setPasscode={setPasscode}
                    setProfileId={setProfileId}
                    submitJoin={submitJoin}
                  />
                )}
              </Flex>
            </Card>

            <div className="rail-stack">
              <Card size="4" className="story-surface surface-level-cool">
                <Flex direction="column" gap="4" height="100%">
                  <Flex justify="between" align="center" className="panel-header panel-header-tight">
                    <Flex align="center" gap="2">
                      <Users2 size={16} />
                      <Heading size="4">Together</Heading>
                    </Flex>
                    <Button size="2" variant="ghost" onClick={() => setPanel('people')}>
                      Open
                    </Button>
                  </Flex>

                  <Flex direction="column" gap="3">
                    {(['dyrane', 'jelo'] as PersonId[]).map((personId) => {
                      const person = getPerson(personId);
                      const member = members.find((item) => item.name === person.name);

                      return (
                        <Flex key={person.id} align="center" justify="between" gap="3" className="member-strip">
                          <Flex align="center" gap="3">
                            <Avatar fallback={person.avatar} size="3" radius="full" />
                            <Box>
                              <Text as="p" size="2" weight="medium">
                                {person.name}
                              </Text>
                              <Text as="p" size="1" color="gray">
                                {person.city}
                              </Text>
                            </Box>
                          </Flex>
                          <Badge radius="full" color={member?.online ? 'green' : 'gray'} variant="soft">
                            {member?.online ? 'online' : 'away'}
                          </Badge>
                        </Flex>
                      );
                    })}
                  </Flex>

                  <Button size="3" className="surface-button" variant="soft" onClick={toggleReady} disabled={!snapshot || sending}>
                    {snapshot?.me?.ready ? 'Ready now' : 'Set ready'}
                  </Button>
                </Flex>
              </Card>

              <Card size="4" className="story-surface surface-level-warm">
                <Flex direction="column" gap="4" height="100%">
                  <Flex justify="between" align="center" className="panel-header panel-header-tight">
                    <Flex align="center" gap="2">
                      <MessageCircleMore size={16} />
                      <Heading size="4">Story</Heading>
                    </Flex>
                    <Button size="2" variant="ghost" onClick={() => setPanel('chat')}>
                      Open
                    </Button>
                  </Flex>

                  <Box className="story-preview">
                    <Text size="1" color="gray">
                      Latest
                    </Text>
                    <Text as="p" size="3" weight="medium" mt="2">
                      {lastMessage ? lastMessage.body : 'Quiet for now.'}
                    </Text>
                    <Text as="p" size="2" color="gray" mt="2">
                      {lastMessage ? `${lastMessage.sender} · ${lastMessage.time}` : 'Chat opens only when needed.'}
                    </Text>
                  </Box>

                  <Box className="story-preview muted">
                    <Flex align="center" gap="2">
                      <Tv size={16} />
                      <Strong>{extensionState.title || 'Netflix idle'}</Strong>
                    </Flex>
                    <Text as="p" size="2" color="gray" mt="2">
                      {extensionError || (extensionConnected ? 'The bridge is listening.' : 'Extension is waiting.')}
                    </Text>
                  </Box>

                  <Button size="3" className="surface-button" variant="soft" onClick={() => setPanel('access')}>
                    Room flow
                  </Button>
                </Flex>
              </Card>
            </div>
          </div>
        </Flex>
      </div>

      <Flex className="mobile-dock" gap="2" justify="center">
        <Button size="3" className="dock-button" variant="soft" data-active={panel === 'people'} onClick={() => setPanel('people')}>
          People
        </Button>
        <Button size="3" className="dock-button" variant="soft" data-active={panel === 'chat'} onClick={() => setPanel('chat')}>
          Chat
        </Button>
        <Button size="3" className="dock-button" variant="soft" data-active={panel === 'access'} onClick={() => setPanel('access')}>
          Room
        </Button>
      </Flex>

      {panel ? (
        <>
          <button type="button" className="story-overlay" aria-label="Close panel" onClick={() => setPanel(null)} />
          <section className="story-sheet" aria-label={panelTitle(panel)}>
            <Flex align="center" justify="between" gap="3" className="sheet-topbar">
              <Box>
                <Text size="1" weight="medium" className="sheet-kicker">
                  Story panel
                </Text>
                <Heading size="5">{panelTitle(panel)}</Heading>
              </Box>
              <IconButton size="3" radius="full" variant="soft" className="surface-button" onClick={() => setPanel(null)} aria-label="Close panel">
                <Cross2Icon />
              </IconButton>
            </Flex>

            <div className="sheet-body">
              {panel === 'people' ? <PeoplePanel members={members} /> : null}
              {panel === 'chat' ? <ChatPanel draftMessage={draftMessage} sending={sending} sendMessage={sendMessage} setDraftMessage={setDraftMessage} snapshot={snapshot} /> : null}
              {panel === 'access' ? <AccessPanel currentTitle={roomConfig.roomTitle} error={error} extensionConnected={extensionConnected} joining={joining} passcode={passcode} profileId={profileId} setPasscode={setPasscode} setProfileId={setProfileId} snapshot={snapshot} submitJoin={submitJoin} /> : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function PeoplePanel({ members }: { members: RoomSnapshot['members'] }) {
  return (
    <Flex direction="column" gap="3">
      {(['dyrane', 'jelo'] as PersonId[]).map((personId) => {
        const person = getPerson(personId);
        const member = members.find((item) => item.name === person.name);

        return (
          <Card key={person.id} className="sheet-card">
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap="3">
                <Avatar fallback={person.avatar} size="4" radius="full" />
                <Box>
                  <Text as="p" size="3" weight="medium">
                    {person.name}
                  </Text>
                  <Text as="p" size="2" color="gray">
                    {person.city}
                  </Text>
                </Box>
              </Flex>
              <Flex direction="column" align="end" gap="2">
                <Badge radius="full" color={member?.online ? 'green' : 'gray'} variant="soft">
                  {member?.online ? 'online' : 'away'}
                </Badge>
                <Badge radius="full" color={member?.ready ? 'green' : 'gray'} variant="soft">
                  {member?.ready ? 'ready' : 'waiting'}
                </Badge>
              </Flex>
            </Flex>
          </Card>
        );
      })}
    </Flex>
  );
}

function ChatPanel({
  draftMessage,
  sending,
  sendMessage,
  setDraftMessage,
  snapshot,
}: {
  draftMessage: string;
  sending: boolean;
  sendMessage: () => void;
  setDraftMessage: (value: string) => void;
  snapshot: RoomSnapshot | null;
}) {
  return (
    <Flex direction="column" gap="3" height="100%">
      <ScrollArea type="auto" scrollbars="vertical" className="sheet-scroll">
        <Flex direction="column" gap="2" pr="2">
          {(snapshot?.messages ?? []).map((message) => (
            <Box key={message.id} className="sheet-bubble">
              <Flex justify="between" gap="3" align="center">
                <Strong>{message.sender}</Strong>
                <Text size="1" color="gray">
                  {message.time}
                </Text>
              </Flex>
              <Text as="p" size="2" color="gray" mt="1">
                {message.body}
              </Text>
            </Box>
          ))}
        </Flex>
      </ScrollArea>

      <Flex gap="2" mt="auto">
        <TextField.Root
          size="3"
          value={draftMessage}
          onChange={(event) => setDraftMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              sendMessage();
            }
          }}
          placeholder="Message"
          className="sheet-input"
        />
        <IconButton size="3" onClick={sendMessage} disabled={!snapshot || sending} aria-label="Send message">
          <PaperPlaneIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
}

function AccessPanel({
  currentTitle,
  error,
  extensionConnected,
  joining,
  passcode,
  profileId,
  setPasscode,
  setProfileId,
  snapshot,
  submitJoin,
}: {
  currentTitle: string;
  error: string;
  extensionConnected: boolean;
  joining: boolean;
  passcode: string;
  profileId: PersonId;
  setPasscode: (value: string) => void;
  setProfileId: (value: PersonId) => void;
  snapshot: RoomSnapshot | null;
  submitJoin: () => void;
}) {
  return (
    <Flex direction="column" gap="3">
      <Card className="sheet-card">
        <Flex direction="column" gap="2">
          <Text size="1" color="gray">
            Room
          </Text>
          <Strong>{currentTitle}</Strong>
          <Text size="2" color="gray">
            {snapshot ? 'The room is live. Keep this passcode private.' : 'Choose the right profile if the auto-detection missed.'}
          </Text>
        </Flex>
      </Card>

      <Flex gap="2" wrap="wrap">
        {(['dyrane', 'jelo'] as PersonId[]).map((optionId) => {
          const person = getPerson(optionId);

          return (
            <Button key={person.id} size="3" variant={profileId === optionId ? 'solid' : 'soft'} className="profile-chip" onClick={() => setProfileId(optionId)}>
              {person.name}
              <span className="profile-chip-meta">{person.city}</span>
            </Button>
          );
        })}
      </Flex>

      <TextField.Root size="3" value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0326" type="password" inputMode="numeric">
        <TextField.Slot>
          <LockKeyhole size={16} />
        </TextField.Slot>
      </TextField.Root>

      <Flex gap="2" wrap="wrap">
        <Button size="3" onClick={submitJoin} loading={joining} disabled={passcode.length !== 4}>
          {snapshot ? 'Refresh access' : 'Enter room'}
        </Button>
        <StatusChip active={extensionConnected} label={extensionConnected ? 'Extension ready' : 'Extension waiting'} />
      </Flex>

      {error ? (
        <Text size="2" color="red">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}

function GateSurface({
  detectedProfileId,
  error,
  joining,
  passcode,
  profileId,
  setPasscode,
  setProfileId,
  submitJoin,
}: {
  detectedProfileId: PersonId | null;
  error: string;
  joining: boolean;
  passcode: string;
  profileId: PersonId;
  setPasscode: (value: string) => void;
  setProfileId: (value: PersonId) => void;
  submitJoin: () => void;
}) {
  return (
    <Flex direction="column" gap="4" className="gate-panel">
      <Flex direction="column" gap="2">
        <Text size="2" color="gray">
          {detectedProfileId === profileId ? `Detected ${getPerson(profileId).name}.` : `Welcome ${getPerson(profileId).name}.`}
        </Text>
        <Text size="4" weight="medium">
          Passcode?
        </Text>
      </Flex>

      <Flex gap="2" wrap="wrap">
        {(['dyrane', 'jelo'] as PersonId[]).map((optionId) => {
          const person = getPerson(optionId);

          return (
            <Button key={person.id} size="3" variant={profileId === optionId ? 'solid' : 'soft'} className="profile-chip" onClick={() => setProfileId(optionId)}>
              {person.name}
              <span className="profile-chip-meta">{person.city}</span>
            </Button>
          );
        })}
      </Flex>

      <Flex gap="2" className="gate-input-row">
        <TextField.Root size="3" value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0326" type="password" inputMode="numeric" className="passcode-input">
          <TextField.Slot>
            <LockKeyhole size={16} />
          </TextField.Slot>
        </TextField.Root>
        <Button size="3" onClick={submitJoin} loading={joining} disabled={passcode.length !== 4}>
          Unlock
        </Button>
      </Flex>

      {error ? (
        <Text size="2" color="red">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}

function StatusChip({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge size="2" radius="full" variant="soft" color={active ? 'green' : 'gray'}>
      {label}
    </Badge>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Flex align="center" gap="2" className="info-pill">
      {icon}
      <Text size="2">{label}</Text>
    </Flex>
  );
}

function ActionPill({ label }: { label: string }) {
  return (
    <Box className="action-pill">
      <Text size="2">{label}</Text>
    </Box>
  );
}

function panelTitle(panel: PanelType) {
  if (panel === 'people') return 'Together';
  if (panel === 'chat') return 'Story';
  return 'Room';
}

async function postJson<T = { ok: true }>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}
