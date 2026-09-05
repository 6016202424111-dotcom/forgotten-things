const STORAGE_KEY = 'reminders-v1';

function pad(n) { return String(n).padStart(2, '0'); }
function nowHM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1108].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch (e) { /* audio unavailable */ }
}

let reminders = [];
let firing = [];

function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    reminders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    reminders = [];
  }
}

function saveReminders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    document.getElementById('saveError').style.display = 'none';
  } catch (e) {
    document.getElementById('saveError').style.display = 'block';
  }
}

function render() {
  renderFiring();
  renderList();
}

function renderFiring() {
  const area = document.getElementById('firingArea');
  area.innerHTML = '';
  firing.forEach((id) => {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    const div = document.createElement('div');
    div.className = 'firing-banner';
    div.innerHTML = `
      <div class="icon">🔔</div>
      <div class="body">
        <div class="label">時間です</div>
        <div class="title">${escapeHtml(r.name)}、忘れていませんか？</div>
      </div>
      <button data-id="${r.id}">確認した</button>
    `;
    div.querySelector('button').addEventListener('click', () => {
      firing = firing.filter((fid) => fid !== id);
      render();
    });
    area.appendChild(div);
  });
}

function renderList() {
  const area = document.getElementById('listArea');
  area.innerHTML = '';
  if (reminders.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="big">📖</div>
        <div class="l1">まだ忘れ物アラームがありません。</div>
        <div class="l2">下のボタンから最初のアラームを登録しましょう。</div>
      </div>
    `;
    return;
  }
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  reminders.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'reminder-row';
    row.innerHTML = `
      <div class="reminder-dot ${r.active ? 'active' : 'inactive'}"></div>
      <div class="reminder-card ${r.active ? '' : 'inactive'}">
        <div class="time-block">
          <div class="clock-icon">🕐</div>
          <div class="time-text">${r.time}</div>
        </div>
        <div class="reminder-info">
          <div class="name">${escapeHtml(r.name)}</div>
          <div class="repeat">${r.repeat === 'daily' ? '毎日くり返す' : '今日だけ'}</div>
        </div>
        <button class="icon-btn toggle ${r.active ? 'active' : 'inactive'}" title="一時停止/再開">✔</button>
        <button class="icon-btn delete" title="削除">🗑</button>
      </div>
    `;
    row.querySelector('.toggle').addEventListener('click', () => {
      r.active = !r.active;
      saveReminders();
      render();
    });
    row.querySelector('.delete').addEventListener('click', () => {
      reminders = reminders.filter((x) => x.id !== r.id);
      firing = firing.filter((fid) => fid !== r.id);
      saveReminders();
      render();
    });
    timeline.appendChild(row);
  });
  area.appendChild(timeline);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function checkAlarms() {
  const hm = nowHM();
  document.getElementById('clock').textContent = hm;
  const today = todayStr();
  const due = reminders.filter((r) => r.active && r.time === hm && r.lastFiredDate !== today);
  if (due.length > 0) {
    playChime();
    due.forEach((d) => {
      d.lastFiredDate = today;
      if (d.repeat === 'once') d.active = false;
      firing.push(d.id);
    });
    saveReminders();
    render();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      due.forEach((d) => new Notification('忘れ物アラーム', { body: `${d.name} を忘れていませんか？` }));
    }
  }
}

function addReminder() {
  const name = document.getElementById('nameInput').value.trim();
  const time = document.getElementById('timeInput').value;
  const repeat = document.getElementById('repeatInput').value;
  if (!name || !time) return;
  reminders.push({
    id: Date.now().toString(),
    name,
    time,
    repeat,
    active: true,
    lastFiredDate: null,
  });
  reminders.sort((a, b) => a.time.localeCompare(b.time));
  saveReminders();
  document.getElementById('nameInput').value = '';
  document.getElementById('timeInput').value = '07:30';
  document.getElementById('repeatInput').value = 'daily';
  closeForm();
  render();
}

function openForm() {
  document.getElementById('addForm').classList.add('open');
  document.getElementById('addToggleBtn').classList.add('hidden');
}
function closeForm() {
  document.getElementById('addForm').classList.remove('open');
  document.getElementById('addToggleBtn').classList.remove('hidden');
}

document.getElementById('addToggleBtn').addEventListener('click', openForm);
document.getElementById('closeFormBtn').addEventListener('click', closeForm);
document.getElementById('submitBtn').addEventListener('click', addReminder);

// 通知許可のリクエスト
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
  Notification.requestPermission();
}

// PWAとしてインストールされていない(通常のブラウザタブの)ときだけ案内バナーを出す
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
if (!isStandalone()) {
  document.getElementById('installBanner').classList.add('show');
}

// サービスワーカー登録(オフライン対応)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

loadReminders();
render();
checkAlarms();
setInterval(checkAlarms, 15000);
