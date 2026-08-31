import {
  getCurrentUser, getCurrentProfile, onAuthChange,
  signIn, signUp, signOut,
  getDemonList, addDemon, deleteDemon,
  submitRecord, getMyRecords,
  getPendingRecords, reviewRecord,
  submitLevel, getMyLevelSubmissions,
  getPendingLevelSubmissions, reviewLevelSubmission,
  getLeaderboard, getPlayerProfile, setUserRole,
} from './api.js';

let currentProfile = null;

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
    document.getElementById('account-details').textContent =
      `Logged in as ${currentProfile.username} — role: ${currentProfile.role}`;
    adminTab.classList.toggle('hidden', currentProfile.role === 'user');
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
async function loadDemonList() {
  const el = document.getElementById('demon-list');
  try {
    const demons = await getDemonList();
    el.innerHTML = demons.length ? demons.map(d => `
      <div class="demon-row">
        <div class="pos">#${d.position}</div>
        <div class="info">
          <div class="name">${escapeHTML(d.name)}</div>
          <div class="meta">
            ${d.publisher ? `by ${escapeHTML(d.publisher)}` : ''}
            ${d.verifier ? ` &middot; verified by ${escapeHTML(d.verifier)}` : ''}
            ${d.video_url ? ` &middot; <a href="${d.video_url}" target="_blank" rel="noopener">video</a>` : ''}
          </div>
        </div>
        <div class="points">${d.points} pts</div>
      </div>
    `).join('') : '<p class="subtext">No levels on the list yet.</p>';
  } catch (err) {
    el.innerHTML = `<p class="form-message error">Failed to load list: ${err.message}</p>`;
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
        <td>${i + 1}</td>
        <td>${escapeHTML(r.username)}</td>
        <td>${r.points}</td>
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
        <td>${escapeHTML(r.profiles?.username ?? r.player_id)}</td>
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
        <td>${escapeHTML(s.profiles?.username ?? s.submitted_by)}</td>
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
}

async function loadManageDemons() {
  const body = document.getElementById('manage-demons-body');
  const demons = await getDemonList();
  body.innerHTML = demons.map(d => `
    <tr>
      <td>${d.position}</td>
      <td>${escapeHTML(d.name)}</td>
      <td>${d.points}</td>
      <td><button class="mini-btn reject" data-delete-id="${d.id}">Delete</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this demon from the list?')) return;
      await deleteDemon(Number(btn.dataset.deleteId));
      loadManageDemons();
      loadDemonList();
    });
  });
}

document.getElementById('add-demon-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('add-demon-message');
  msg.textContent = ''; msg.className = 'form-message';
  try {
    await addDemon({
      name: document.getElementById('ad-name').value,
      position: Number(document.getElementById('ad-position').value),
      videoUrl: document.getElementById('ad-video').value || null,
      publisher: document.getElementById('ad-publisher').value || null,
      verifier: document.getElementById('ad-verifier').value || null,
      minPercent: Number(document.getElementById('ad-minpercent').value) || 100,
    });
    msg.textContent = 'Demon added.'; msg.classList.add('success');
    e.target.reset();
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
