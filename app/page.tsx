'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Copy,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Send,
  Sparkles,
  Tv2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DEFAULT_ROOM_ID, DEMO_INSTALL_STEPS, formatTime, getOrCreateSession } from '@/lib/watch-room';

type Presence = {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
  role: 'host' | 'guest';
};

type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  time: string;
};

const initialPresence: Presence[] = [
  { id: 'you', name: 'You', ready: true, online: true, role: 'host' },
  { id: 'her', name: 'Her', ready: false, online: false, role: 'guest' },
];

const initialMessages: ChatMessage[] = [
  { id: '1', sender: 'System', text: 'Room is ready. Open Netflix in another tab and connect the extension.', time: 'now' },
  { id: '2', sender: 'System', text: 'This starter UI uses local demo state until you wire your real socket backend.', time: 'now' },
];

export default function Page() {
  const session = useMemo(() => getOrCreateSession(), []);
  const [roomId] = useState(DEFAULT_ROOM_ID);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [presence, setPresence] = useState(initialPresence);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(18 * 60 + 42);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [movieTitle, setMovieTitle] = useState('Choose your Netflix title');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime((prev) => (isPlaying ? prev + 1 : prev));
    }, 1000);

    const fakeBackend = window.setTimeout(() => setBackendConnected(true), 900);
    const fakePresence = window.setTimeout(() => {
      setPresence((prev) => prev.map((user) => (user.id === 'her' ? { ...user, online: true } : user)));
    }, 1600);

    const handshake = () => {
      window.postMessage({ source: 'watch-room-app', type: 'PING_EXTENSION' }, '*');
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.source === 'watch-room-extension' && event.data?.type === 'EXTENSION_READY') {
        setExtensionConnected(true);
      }

      if (event.data?.source === 'watch-room-extension' && event.data?.type === 'NETFLIX_STATE') {
        if (typeof event.data.currentTime === 'number') {
          setTime(Math.floor(event.data.currentTime));
        }
        if (typeof event.data.paused === 'boolean') {
          setIsPlaying(!event.data.paused);
        }
        if (typeof event.data.title === 'string' && event.data.title.trim()) {
          setMovieTitle(event.data.title.trim());
        }
      }
    };

    window.addEventListener('message', onMessage);
    handshake();
    const repeatHandshake = window.setInterval(handshake, 3000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fakeBackend);
      window.clearTimeout(fakePresence);
      window.clearInterval(repeatHandshake);
      window.removeEventListener('message', onMessage);
    };
  }, [isPlaying]);

  const sendControl = (action: 'PLAY' | 'PAUSE' | 'SEEK_FORWARD' | 'SEEK_BACKWARD' | 'SYNC_NOW') => {
    if (action === 'PLAY') setIsPlaying(true);
    if (action === 'PAUSE') setIsPlaying(false);
    if (action === 'SEEK_FORWARD') setTime((prev) => prev + 10);
    if (action === 'SEEK_BACKWARD') setTime((prev) => Math.max(0, prev - 10));

    window.postMessage(
      {
        source: 'watch-room-app',
        type: 'APP_CONTROL',
        payload: {
          roomId,
          action,
          currentTime: time,
          sessionId: session.id,
          sender: session.name,
        },
      },
      '*',
    );
  };

  const toggleReady = () => {
    setPresence((prev) =>
      prev.map((user) => (user.id === 'you' ? { ...user, ready: !user.ready } : user)),
    );
  };

  const addMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: session.name,
        text: trimmed,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
      },
    ]);
    setMessage('');
  };

  const copyInvite = async () => {
    const invite = typeof window !== 'undefined' ? `${window.location.origin}?room=${roomId}` : roomId;
    await navigator.clipboard.writeText(invite);
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1400);
  };

  return (
    <main className="page-shell">
      <section className="hero-card glass">
        <div className="hero-topbar">
          <div>
            <p className="eyebrow">Private watch room</p>
            <h1>{roomId}</h1>
            <p className="muted">One reusable link. No auth. Extension-powered Netflix control.</p>
          </div>
          <button className="ghost-button" onClick={copyInvite}>
            <Copy size={16} />
            {inviteCopied ? 'Copied' : 'Copy invite'}
          </button>
        </div>

        <div className="status-grid">
          <StatusPill icon={<Wifi size={16} />} label="Room backend" value={backendConnected ? 'Connected' : 'Connecting'} good={backendConnected} />
          <StatusPill icon={<Tv2 size={16} />} label="Chrome extension" value={extensionConnected ? 'Connected' : 'Waiting'} good={extensionConnected} />
          <StatusPill icon={<Users size={16} />} label="Presence" value={`${presence.filter((p) => p.online).length}/2 online`} good />
          <StatusPill icon={<Clock3 size={16} />} label="Current time" value={formatTime(time)} good />
        </div>
      </section>

      <section className="content-grid">
        <div className="left-stack">
          <article className="feature-card glass stage-card">
            <div className="stage-header">
              <div>
                <p className="eyebrow">Now watching</p>
                <h2>{movieTitle}</h2>
              </div>
              <div className={`live-dot ${isPlaying ? 'live' : ''}`}>
                <Activity size={14} />
                {isPlaying ? 'Playing' : 'Paused'}
              </div>
            </div>

            <div className="time-display">{formatTime(time)}</div>

            <div className="control-row">
              <button className="control-button primary" onClick={() => sendControl(isPlaying ? 'PAUSE' : 'PLAY')}>
                {isPlaying ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                {isPlaying ? 'Pause together' : 'Play together'}
              </button>
              <button className="control-button" onClick={() => sendControl('SEEK_BACKWARD')}>
                -10s
              </button>
              <button className="control-button" onClick={() => sendControl('SEEK_FORWARD')}>
                +10s
              </button>
              <button className="control-button" onClick={() => sendControl('SYNC_NOW')}>
                <RefreshCcw size={16} />
                Sync now
              </button>
            </div>

            <div className="sub-grid">
              <div className="mini-panel">
                <div className="mini-panel-top">
                  <Sparkles size={16} />
                  <span>Host actions</span>
                </div>
                <p>Use the controls here. The extension listens for play, pause, seek, and state sync.</p>
              </div>
              <div className="mini-panel">
                <div className="mini-panel-top">
                  {extensionConnected ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
                  <span>Extension bridge</span>
                </div>
                <p>
                  {extensionConnected
                    ? 'Bridge found. Wire this to your socket backend and content script next.'
                    : 'Load the extension, open Netflix, then refresh this page to complete the handshake.'}
                </p>
              </div>
            </div>
          </article>

          <article className="feature-card glass">
            <div className="section-heading">
              <h3>Presence</h3>
              <button className="ghost-button" onClick={toggleReady}>
                <CheckCircle2 size={16} />
                Toggle ready
              </button>
            </div>
            <div className="presence-list">
              {presence.map((person) => (
                <div key={person.id} className="presence-item">
                  <div>
                    <strong>{person.name}</strong>
                    <p>
                      {person.role} · {person.online ? 'online' : 'offline'}
                    </p>
                  </div>
                  <span className={`badge ${person.ready ? 'badge-good' : 'badge-muted'}`}>
                    {person.ready ? 'Ready' : 'Not ready'}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="right-stack">
          <article className="feature-card glass">
            <div className="section-heading">
              <h3>Install flow</h3>
              <span className="badge badge-muted">one time only</span>
            </div>
            <ol className="steps-list">
              {DEMO_INSTALL_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>

          <article className="feature-card glass chat-card">
            <div className="section-heading">
              <h3>Chat</h3>
              <MessageCircle size={16} />
            </div>

            <div className="chat-stream">
              {messages.map((item) => (
                <div key={item.id} className="chat-bubble">
                  <div className="chat-meta">
                    <strong>{item.sender}</strong>
                    <span>{item.time}</span>
                  </div>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addMessage();
                }}
                placeholder="Type a message"
              />
              <button className="control-button primary" onClick={addMessage}>
                <Send size={16} />
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function StatusPill({
  icon,
  label,
  value,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="status-pill">
      <span className={`status-icon ${good ? 'good' : 'muted'}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
