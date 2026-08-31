import { getCurrentUser, getDemonList } from './api.js';

// A tiny delay so supabaseClient.js finishes running initSupabase() first
setTimeout(async () => {
  const statusEl = document.getElementById('auth-status');
  const listEl = document.getElementById('demon-list');

  try {
    const user = await getCurrentUser();
    statusEl.textContent = user ? `Logged in as ${user.email}` : 'Not logged in';
  } catch (err) {
    statusEl.textContent = `Auth check failed: ${err.message}`;
  }

  try {
    const demons = await getDemonList();
    listEl.innerHTML = demons.length
      ? demons.map(d => `<li>#${d.position} — ${d.name} (${d.points} pts)</li>`).join('')
      : '<li>No demons added yet — add some from the Supabase Table Editor or via addDemon().</li>';
  } catch (err) {
    listEl.innerHTML = `<li>Failed to load: ${err.message}</li>`;
  }
}, 100);
