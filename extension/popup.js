const roomChip = document.getElementById('room-chip');
const netflixChip = document.getElementById('netflix-chip');
const onlineChip = document.getElementById('online-chip');
const roomTitle = document.getElementById('room-title');
const roomSubtitle = document.getElementById('room-subtitle');
const netflixTitle = document.getElementById('netflix-title');
const netflixSubtitle = document.getElementById('netflix-subtitle');
const heroSubtitle = document.getElementById('hero-subtitle');
const footerStatus = document.getElementById('footer-status');
const openRoomButton = document.getElementById('open-room');
const openNetflixButton = document.getElementById('open-netflix');

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setChipState(element, label, active) {
  element.textContent = label;
  element.classList.toggle('active', active);
}

function renderStatus(status) {
  const roomLive = Boolean(status.room?.found);
  const netflixLive = Boolean(status.netflix?.found);
  const onlineCount = Number(status.room?.onlineCount ?? 0);

  roomTitle.textContent = status.room?.title || 'Watch Room';
  roomSubtitle.textContent = roomLive
    ? status.room?.subtitle || 'Room connected'
    : 'Open your deployed room app to connect the bridge.';

  netflixTitle.textContent = netflixLive ? status.netflix?.title || 'Netflix ready' : 'Netflix not ready';
  netflixSubtitle.textContent = netflixLive
    ? `${status.netflix?.paused ? 'Paused' : 'Playing'} · ${formatTime(status.netflix?.currentTime ?? 0)}`
    : 'Launch Netflix and the overlay will attach automatically.';

  heroSubtitle.textContent =
    roomLive && netflixLive
      ? 'Cinema ready from the toolbar.'
      : roomLive
        ? 'Room connected. Open Netflix next.'
        : netflixLive
          ? 'Netflix found. Open the room next.'
          : 'Open your room or Netflix to wake the bridge.';

  footerStatus.textContent =
    roomLive && netflixLive
      ? 'Bridge is live across toolbar, room, and Netflix.'
      : roomLive
        ? 'Room is live. The toolbar can open or focus Netflix.'
        : 'Toolbar controls are ready.';

  setChipState(roomChip, roomLive ? 'Room live' : 'Room idle', roomLive);
  setChipState(netflixChip, netflixLive ? 'Netflix found' : 'Netflix idle', netflixLive);
  setChipState(onlineChip, `${onlineCount} online`, onlineCount > 0);
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATUS' });
  renderStatus(status);
}

openRoomButton.addEventListener('click', async () => {
  footerStatus.textContent = 'Opening room...';
  await chrome.runtime.sendMessage({ type: 'OPEN_ROOM' });
  window.close();
});

openNetflixButton.addEventListener('click', async () => {
  footerStatus.textContent = 'Opening Netflix...';
  await chrome.runtime.sendMessage({ type: 'OPEN_NETFLIX' });
  window.close();
});

void refreshStatus();
