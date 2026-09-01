import {
  getCurrentUser, getCurrentProfile, onAuthChange,
  signIn, signUp, signOut, updateMyProfile,
  getDemonList, getDemon, addDemon, updateDemon, deleteDemon,
  submitRecord, getMyRecords, getRecordsForDemon,
  getPendingRecords, reviewRecord, getAllRecords, deleteRecord,
  submitLevel, getMyLevelSubmissions,
  getPendingLevelSubmissions, reviewLevelSubmission,
  getLeaderboard, getPlayerProfile, setUserRole,
} from './api.js';

let currentProfile = null;

// ----------------------------------------------------------------------------
// NATIONALITY <select> — built once from ISO 3166-1 alpha-2 codes
// ----------------------------------------------------------------------------
const COUNTRY_CODES = ["AD","AE","AF","AG","AI","AL","AM","AO","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","YE","YT","ZA","ZM","ZW"];

function flagEmoji(code) {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** <img> tag for a country's flag, e.g. flagImg('US'). Falls back to nothing if no code given. */
function flagImg(code) {
  if (!code) return '';
  const lower = code.toLowerCase();
  return `<img class="flag-icon" src="flags/${lower}.svg" alt="${code.toUpperCase()}" title="${code.toUpperCase()}" loading="lazy">`;
}

function populateNationalitySelect() {
  const select = document.getElementById('profile-nationality');
  if (!select || select.dataset.populated) return;
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const options = COUNTRY_CODES
    .map(code => ({ code, name: regionNames.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const { code, name } of options) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${flagEmoji(code)} ${name}`;
    select.appendChild(opt);
  }
  select.dataset.populated = 'true';
}
populateNationalitySelect();

/** "[CLAN] Display Name" (or flag-prefixed) — falls back to username if no display name is set. */
function formatPlayerName(profile) {
  if (!profile) return '';
  const name = profile.display_name || profile.username;
  const tag = profile.clan ? `[${profile.clan}] ` : '';
  return `${tag}${name}`;
}

/** Flag + [clan] + name as an HTML snippet, for table cells. Expects a profiles-shaped object. */
function playerCellHTML(profile) {
  if (!profile) return '';
  const flag = profile.nationality ? `${flagImg(profile.nationality)} ` : '';
  const clan = profile.clan ? `<span class="clan-tag">[${escapeHTML(profile.clan)}]</span> ` : '';
  const name = escapeHTML(profile.display_name || profile.username || '');
  return `${flag}${clan}${name}`;
}

/** Converts a normal YouTube watch/share URL to an embeddable URL. Returns null if it can't. */
function toYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/embed/')) return url;
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// NAVIGATION
// ----------------------------------------------------------------------------
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));

  if (name === 'list') loadDemonList();
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'submit') loadSubmitView();
  if (name === 'admin') loadAdminView();
}

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.view));
});

// ----------------------------------------------------------------------------
// AUTH STATE
// ----------------------------------------------------------------------------
async function refreshAuthUI() {
  const user = await getCurrentUser();
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn = document.getElementById('account-logged-in');
  const adminTab = document.getElementById('nav-admin');

  if (user) {
    currentProfile = await getCurrentProfile();
    loggedOut.classList.add('hidden');
    loggedIn.classList.remove('hidden');
    const flag = currentProfile.nationality ? `${flagEmoji(currentProfile.nationality)} ` : '';
    document.getElementById('account-details').textContent =
      `Logged in as ${flag}${formatPlayerName(currentProfile)} (${currentProfile.username}) — role: ${currentProfile.role}`;
    adminTab.classList.toggle('hidden', currentProfile.role === 'user');

    document.getElementById('profile-display-name').value = currentProfile.display_name ?? '';
    document.getElementById('profile-nationality').value = currentProfile.nationality ?? '';
    document.getElementById('profile-clan').value = currentProfile.clan ?? '';
  } else {
    currentProfile = null;
    loggedOut.classList.remove('hidden');
    loggedIn.classList.add('hidden');
    adminTab.classList.add('hidden');
  }
}

onAuthChange(() => refreshAuthUI());

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  showView('list');
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('profile-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    currentProfile = await updateMyProfile({
      displayName: document.getElementById('profile-display-name').value,
      nationality: document.getElementById('profile-nationality').value,
      clan: document.getElementById('profile-clan').value,
    });
    const flag = currentProfile.nationality ? `${flagEmoji(currentProfile.nationality)} ` : '';
    document.getElementById('account-details').textContent =
      `Logged in as ${flag}${formatPlayerName(currentProfile)} (${currentProfile.username}) — role: ${currentProfile.role}`;
    msg.textContent = 'Profile saved.'; msg.classList.add('success');
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

// login/register toggle
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('login-form').classList.toggle('hidden', btn.dataset.mode !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', btn.dataset.mode !== 'register');
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('login-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    await signIn({
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value,
    });
    msg.textContent = 'Logged in!'; msg.classList.add('success');
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('register-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    await signUp({
      username: document.getElementById('register-username').value,
      password: document.getElementById('register-password').value,
    });
    msg.textContent = 'Registered! You can log in now.';
    msg.classList.add('success');
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

// ----------------------------------------------------------------------------
// DEMON LIST
// ----------------------------------------------------------------------------
function youtubeThumbnail(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/** Swap a broken thumbnail <img> for the striped placeholder, keeping the rank visible. */
window.handleThumbError = function (img, position) {
  const placeholder = document.createElement('div');
  placeholder.className = 'demon-thumb placeholder';
  placeholder.textContent = `#${position}`;
  img.replaceWith(placeholder);
};

async function loadDemonList() {
  const el = document.getElementById('demon-list');
  try {
    const demons = await getDemonList();
    const countEl = document.getElementById('level-count');
    if (countEl) countEl.textContent = demons.length ? ` \u2014 ${demons.length} tracked` : '';
    el.innerHTML = demons.length ? demons.map(d => {
      const thumb = d.thumbnail_url || youtubeThumbnail(d.video_url);
      return `
      <div class="demon-row" data-demon-id="${d.id}">
        <div class="thumb-wrap">
          ${thumb
            ? `<img class="demon-thumb" src="${thumb}" alt="" loading="lazy" onerror="handleThumbError(this, ${d.position})">`
            : `<div class="demon-thumb placeholder">#${d.position}</div>`}
        </div>
        <div class="info">
          <div class="name"><span class="rank">#${d.position}</span> ${escapeHTML(d.name)}</div>
          <div class="meta">
            ${d.publisher ? escapeHTML(d.publisher) : ''}
            ${d.verifier ? `<span class="sep">|</span> <span class="verifier">${escapeHTML(d.verifier)}</span>` : ''}
            <span class="sep">&middot;</span> ${d.min_percent}% <span class="range-arrow">&mdash;</span> <span class="pts-inline">${d.points} points</span>
            ${d.level_id ? `<span class="sep">&middot;</span> ID ${escapeHTML(String(d.level_id))}` : ''}
          </div>
        </div>
        ${d.video_url ? `<a class="watch-link" href="${d.video_url}" target="_blank" rel="noopener">watch</a>` : ''}
      </div>
    `;
    }).join('') : '<p class="subtext">No levels on the list yet.</p>';

    el.querySelectorAll('.demon-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // let the "watch" link open normally
        showLevelDetail(Number(row.dataset.demonId));
      });
    });
  } catch (err) {
    el.innerHTML = `<p class="form-message error">Failed to load list: ${err.message}</p>`;
  }
}

// ----------------------------------------------------------------------------
// LEVEL DETAIL
// ----------------------------------------------------------------------------
function showLevelDetail(demonId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-level').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'list'));
  loadLevelDetail(demonId);
}

document.getElementById('back-to-list').addEventListener('click', () => showView('list'));

async function loadLevelDetail(demonId) {
  const container = document.getElementById('level-detail');
  container.innerHTML = 'Loading&hellip;';
  try {
    const demon = await getDemon(demonId);
    const records = await getRecordsForDemon(demonId);
    const embedUrl = demon.video_url ? toYouTubeEmbedUrl(demon.video_url) : null;

    container.innerHTML = `
      <div class="level-title-row">
        <span class="pos">#${demon.position}</span>
        <h1>${escapeHTML(demon.name)}</h1>
      </div>
      <p class="subtext">
        ${demon.publisher ? `published by ${escapeHTML(demon.publisher)}` : ''}
        ${demon.verifier ? ` &middot; verified by ${escapeHTML(demon.verifier)}` : ''}
      </p>

      ${embedUrl
        ? `<div class="video-embed"><iframe src="${embedUrl}" allowfullscreen loading="lazy"></iframe></div>`
        : demon.video_url
          ? `<p><a href="${demon.video_url}" target="_blank" rel="noopener">Watch verification video</a></p>`
          : ''
      }

      <div class="level-stats">
        <div><span class="stat-label">Points (100%)</span><span class="stat-value">${demon.points}</span></div>
        <div><span class="stat-label">Min % to record</span><span class="stat-value">${demon.min_percent}%</span></div>
        ${demon.level_id ? `<div><span class="stat-label">Level ID</span><span class="stat-value">${escapeHTML(String(demon.level_id))}</span></div>` : ''}
      </div>

      <h2>Records (${records.length})</h2>
      <table class="board">
        <thead><tr><th>Player</th><th>Progress</th><th>Video</th></tr></thead>
        <tbody>
          ${records.length ? records.map(r => `
            <tr>
              <td class="player-cell">${playerCellHTML(r.profiles)}</td>
              <td>${r.progress}%</td>
              <td>${r.video_url ? `<a href="${r.video_url}" target="_blank" rel="noopener">watch</a>` : ''}</td>
            </tr>
          `).join('') : '<tr><td colspan="3">No approved records yet.</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p class="form-message error">Failed to load level: ${err.message}</p>`;
  }
}

// ----------------------------------------------------------------------------
// LEADERBOARD
// ----------------------------------------------------------------------------
async function loadLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  try {
    const rows = await getLeaderboard();
    body.innerHTML = rows.length ? rows.map((r, i) => `
      <tr>
        <td>#${i + 1}</td>
        <td class="player-cell">
          ${r.nationality ? flagImg(r.nationality) : ''}
          ${r.clan ? `<span class="clan-tag">[${escapeHTML(r.clan)}]</span>` : ''}
          <span class="player-name">${escapeHTML(r.display_name || r.username)}</span>
        </td>
        <td class="points-cell">${r.points}</td>
        <td>${r.demons_completed}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">No completions yet.</td></tr>';
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="form-message error">${err.message}</td></tr>`;
  }
}

// ----------------------------------------------------------------------------
// SUBMIT RECORD
// ----------------------------------------------------------------------------
async function loadSubmitView() {
  const user = await getCurrentUser();
  document.getElementById('submit-logged-out').classList.toggle('hidden', !!user);
  document.getElementById('submit-form').classList.toggle('hidden', !user);
  document.getElementById('suggest-logged-out').classList.toggle('hidden', !!user);
  document.getElementById('suggest-form').classList.toggle('hidden', !user);

  if (user) {
    const select = document.getElementById('submit-demon');
    const demons = await getDemonList();
    select.innerHTML = demons.map(d => `<option value="${d.id}">#${d.position} — ${escapeHTML(d.name)}</option>`).join('');

    const body = document.getElementById('my-records-body');
    const records = await getMyRecords();
    body.innerHTML = records.length ? records.map(r => `
      <tr>
        <td>${r.demons ? escapeHTML(r.demons.name) : `#${r.demon_id}`}</td>
        <td>${r.progress}%</td>
        <td class="status-${r.status}">${r.status}</td>
        <td>${r.reject_reason ? escapeHTML(r.reject_reason) : ''}</td>
      </tr>
    `).join('') : '<tr><td colspan="4">No records submitted yet.</td></tr>';

    const suggBody = document.getElementById('my-suggestions-body');
    const suggestions = await getMyLevelSubmissions();
    suggBody.innerHTML = suggestions.length ? suggestions.map(s => `
      <tr>
        <td>${escapeHTML(s.level_name)}</td>
        <td class="status-${s.status}">${s.status}</td>
        <td>${s.reject_reason ? escapeHTML(s.reject_reason) : ''}</td>
      </tr>
    `).join('') : '<tr><td colspan="3">No suggestions submitted yet.</td></tr>';
  }
}

document.getElementById('suggest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('suggest-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    await submitLevel({
      levelName: document.getElementById('suggest-name').value,
      levelId: Number(document.getElementById('suggest-levelid').value) || null,
      videoUrl: document.getElementById('suggest-video').value,
      creator: document.getElementById('suggest-creator').value,
      note: document.getElementById('suggest-note').value,
    });
    msg.textContent = 'Suggested! Waiting on staff review.'; msg.classList.add('success');
    e.target.reset();
    loadSubmitView();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

document.getElementById('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('submit-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    await submitRecord({
      demonId: Number(document.getElementById('submit-demon').value),
      progress: Number(document.getElementById('submit-progress').value),
      videoUrl: document.getElementById('submit-video').value,
    });
    msg.textContent = 'Submitted! Waiting on staff review.'; msg.classList.add('success');
    e.target.reset();
    loadSubmitView();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

// ----------------------------------------------------------------------------
// ADMIN / STAFF
// ----------------------------------------------------------------------------
async function loadAdminView() {
  const body = document.getElementById('pending-body');
  try {
    const pending = await getPendingRecords();
    body.innerHTML = pending.length ? pending.map(r => `
      <tr>
        <td class="player-cell">${playerCellHTML(r.profiles)}</td>
        <td>${escapeHTML(r.demons?.name ?? r.demon_id)}</td>
        <td>${r.progress}%</td>
        <td><a href="${r.video_url}" target="_blank" rel="noopener">watch</a></td>
        <td>
          <button class="mini-btn approve" data-id="${r.id}" data-action="approved">Approve</button>
          <button class="mini-btn reject" data-id="${r.id}" data-action="rejected">Reject</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5">Nothing pending.</td></tr>';

    body.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = btn.dataset.action === 'rejected' ? prompt('Reason for rejecting (optional):') || null : null;
        await reviewRecord(Number(btn.dataset.id), { status: btn.dataset.action, rejectReason: reason });
        loadAdminView();
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="form-message error">${err.message}</td></tr>`;
  }

  const adminOnly = document.getElementById('admin-only');
  adminOnly.classList.toggle('hidden', currentProfile?.role !== 'admin');
  if (currentProfile?.role === 'admin') loadManageDemons();

  const levelsBody = document.getElementById('pending-levels-body');
  try {
    const pendingLevels = await getPendingLevelSubmissions();
    levelsBody.innerHTML = pendingLevels.length ? pendingLevels.map(s => `
      <tr>
        <td class="player-cell">${playerCellHTML(s.profiles)}</td>
        <td>${escapeHTML(s.level_name)}${s.level_id ? ` (ID ${s.level_id})` : ''}</td>
        <td>${s.creator ? escapeHTML(s.creator) : ''}</td>
        <td><a href="${s.video_url}" target="_blank" rel="noopener">watch</a></td>
        <td>${s.note ? escapeHTML(s.note) : ''}</td>
        <td>
          <button class="mini-btn approve" data-level-id="${s.id}" data-level-action="approved">Approve</button>
          <button class="mini-btn reject" data-level-id="${s.id}" data-level-action="rejected">Reject</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6">Nothing pending.</td></tr>';

    levelsBody.querySelectorAll('button[data-level-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = btn.dataset.levelAction === 'rejected' ? prompt('Reason for rejecting (optional):') || null : null;
        await reviewLevelSubmission(Number(btn.dataset.levelId), { status: btn.dataset.levelAction, rejectReason: reason });
        if (btn.dataset.levelAction === 'approved') {
          alert('Marked approved. Now add it properly from "Add a Demon" below so you can set its position.');
        }
        loadAdminView();
      });
    });
  } catch (err) {
    levelsBody.innerHTML = `<tr><td colspan="6" class="form-message error">${err.message}</td></tr>`;
  }

  loadAllRecords();
}

async function loadAllRecords(usernameFilter) {
  const body = document.getElementById('all-records-body');
  body.innerHTML = '<tr><td colspan="6">Loading&hellip;</td></tr>';
  try {
    const records = await getAllRecords(usernameFilter);
    body.innerHTML = records.length ? records.map(r => `
      <tr>
        <td class="player-cell">${playerCellHTML(r.profiles)}</td>
        <td>${escapeHTML(r.demons?.name ?? r.demon_id)}</td>
        <td>${r.progress}%</td>
        <td class="status-${r.status}">${escapeHTML(r.status)}</td>
        <td>${r.video_url ? `<a href="${r.video_url}" target="_blank" rel="noopener">watch</a>` : ''}</td>
        <td><button class="mini-btn reject" data-delete-record-id="${r.id}">Delete</button></td>
      </tr>
    `).join('') : '<tr><td colspan="6">No records found.</td></tr>';

    body.querySelectorAll('[data-delete-record-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Permanently delete this record?')) return;
        try {
          await deleteRecord(Number(btn.dataset.deleteRecordId));
          loadAllRecords(document.getElementById('records-filter').value);
          loadAdminView();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="form-message error">${err.message}</td></tr>`;
  }
}

document.getElementById('records-filter-btn').addEventListener('click', () => {
  loadAllRecords(document.getElementById('records-filter').value);
});
document.getElementById('records-filter').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadAllRecords(document.getElementById('records-filter').value);
  }
});

let editingDemonId = null;

async function loadManageDemons() {
  const body = document.getElementById('manage-demons-body');
  const demons = await getDemonList();
  body.innerHTML = demons.map(d => `
    <tr>
      <td>${d.position}</td>
      <td>${escapeHTML(d.name)}</td>
      <td>${d.level_id ? escapeHTML(String(d.level_id)) : '—'}</td>
      <td>${d.points}</td>
      <td><button class="mini-btn" data-edit-id="${d.id}">Edit</button></td>
      <td><button class="mini-btn reject" data-delete-id="${d.id}">Delete</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this demon from the list?')) return;
      await deleteDemon(Number(btn.dataset.deleteId));
      if (editingDemonId === Number(btn.dataset.deleteId)) exitEditMode();
      loadManageDemons();
      loadDemonList();
    });
  });

  body.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.editId);
      const demon = demons.find(d => d.id === id) ?? await getDemon(id);
      enterEditMode(demon);
    });
  });
}

function enterEditMode(demon) {
  editingDemonId = demon.id;
  document.getElementById('ad-name').value = demon.name ?? '';
  document.getElementById('ad-levelid').value = demon.level_id ?? '';
  document.getElementById('ad-position').value = demon.position ?? '';
  document.getElementById('ad-video').value = demon.video_url ?? '';
  document.getElementById('ad-thumbnail').value = demon.thumbnail_url ?? '';
  document.getElementById('ad-publisher').value = demon.publisher ?? '';
  document.getElementById('ad-verifier').value = demon.verifier ?? '';
  document.getElementById('ad-minpercent').value = demon.min_percent ?? 100;

  document.getElementById('add-demon-heading').textContent = `Edit Level: ${demon.name}`;
  document.getElementById('add-demon-submit').textContent = 'Save changes';
  document.getElementById('add-demon-cancel').classList.remove('hidden');
  document.getElementById('add-demon-message').textContent = '';
  document.getElementById('add-demon-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function exitEditMode() {
  editingDemonId = null;
  document.getElementById('add-demon-form').reset();
  document.getElementById('ad-minpercent').value = 100;
  document.getElementById('add-demon-heading').textContent = 'Add a Level';
  document.getElementById('add-demon-submit').textContent = 'Add level';
  document.getElementById('add-demon-cancel').classList.add('hidden');
  document.getElementById('add-demon-message').textContent = '';
}

document.getElementById('add-demon-cancel').addEventListener('click', exitEditMode);

document.getElementById('add-demon-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('add-demon-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    const levelId = Number(document.getElementById('ad-levelid').value);
    if (!levelId || levelId < 1) {
      throw new Error('A valid GD Level ID is required.');
    }
    const fields = {
      name: document.getElementById('ad-name').value,
      levelId,
      position: Number(document.getElementById('ad-position').value),
      videoUrl: document.getElementById('ad-video').value || null,
      thumbnailUrl: document.getElementById('ad-thumbnail').value || null,
      publisher: document.getElementById('ad-publisher').value || null,
      verifier: document.getElementById('ad-verifier').value || null,
      minPercent: Number(document.getElementById('ad-minpercent').value) || 100,
    };
    if (editingDemonId) {
      await updateDemon(editingDemonId, fields);
      msg.textContent = 'Level updated.'; msg.classList.add('success');
      exitEditMode();
    } else {
      await addDemon(fields);
      msg.textContent = 'Demon added.'; msg.classList.add('success');
      e.target.reset();
    }
    loadManageDemons();
    loadDemonList();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

document.getElementById('role-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('role-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    const profile = await getPlayerProfile(document.getElementById('role-username').value);
    await setUserRole(profile.id, document.getElementById('role-select').value);
    msg.textContent = `Updated ${profile.username}'s role.`; msg.classList.add('success');
    e.target.reset();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add('error');
  }
});

// ----------------------------------------------------------------------------
// UTIL
// ----------------------------------------------------------------------------
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ----------------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------------
setTimeout(async () => {
  await refreshAuthUI();
  loadDemonList();
}, 100);
