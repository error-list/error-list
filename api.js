// ============================================================================
// ERROR LIST — API layer
// A thin wrapper around Supabase so your frontend never talks to the
// database directly. Import this file, call initSupabase() once, then use
// the functions below.
//
// Install in your frontend project:
//   npm install @supabase/supabase-js
// ============================================================================

import { createClient } from '@supabase/supabase-js';

let supabase = null;

/** Call this once, before anything else (e.g. at the top of your app). */
export function initSupabase(url, anonKey) {
  supabase = createClient(url, anonKey);
  return supabase;
}

function client() {
  if (!supabase) throw new Error('Call initSupabase(url, anonKey) before using the API.');
  return supabase;
}

// ----------------------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------------------

/** Register a new account. `username` is stored on their profile automatically. */
export async function signUp({ email, password, username }) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

/** Returns the logged-in user's auth info, or null if signed out. */
export async function getCurrentUser() {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  return data.user;
}

/** Returns the logged-in user's profile row (username, role, banned), or null. */
export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await client()
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

/** Fires `callback(user)` whenever auth state changes (login/logout). */
export function onAuthChange(callback) {
  return client().auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// ----------------------------------------------------------------------------
// DEMON LIST
// ----------------------------------------------------------------------------

/** The full list, ordered hardest (position 1) to easiest. */
export async function getDemonList() {
  const { data, error } = await client()
    .from('demons')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getDemon(id) {
  const { data, error } = await client().from('demons').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Admin only (enforced server-side by RLS regardless of who calls this). */
export async function addDemon({ name, position, videoUrl, publisher, verifier, levelId, minPercent }) {
  const { data, error } = await client()
    .from('demons')
    .insert({
      name,
      position,
      video_url: videoUrl,
      publisher,
      verifier,
      level_id: levelId,
      min_percent: minPercent ?? 100,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Admin only. Pass any subset of fields to update; use camelCase keys as above. */
export async function updateDemon(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.position !== undefined) patch.position = fields.position;
  if (fields.videoUrl !== undefined) patch.video_url = fields.videoUrl;
  if (fields.publisher !== undefined) patch.publisher = fields.publisher;
  if (fields.verifier !== undefined) patch.verifier = fields.verifier;
  if (fields.levelId !== undefined) patch.level_id = fields.levelId;
  if (fields.minPercent !== undefined) patch.min_percent = fields.minPercent;
  if (fields.points !== undefined) { patch.points = fields.points; patch.points_override = true; }

  const { data, error } = await client().from('demons').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Admin only. */
export async function deleteDemon(id) {
  const { error } = await client().from('demons').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// RECORDS
// ----------------------------------------------------------------------------

/** Submit a record for the currently logged-in user. Starts out "pending". */
export async function submitRecord({ demonId, progress, videoUrl }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('You must be logged in to submit a record.');

  const { data, error } = await client()
    .from('records')
    .insert({ demon_id: demonId, player_id: user.id, progress, video_url: videoUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** All of the current user's own records, any status, newest first. */
export async function getMyRecords() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await client()
    .from('records')
    .select('*, demons(name, position, points)')
    .eq('player_id', user.id)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** All approved records for one demon (i.e. its public leaderboard of completions). */
export async function getRecordsForDemon(demonId) {
  const { data, error } = await client()
    .from('records')
    .select('*, profiles(username)')
    .eq('demon_id', demonId)
    .eq('status', 'approved')
    .order('progress', { ascending: false });
  if (error) throw error;
  return data;
}

/** Staff only: the review queue. */
export async function getPendingRecords() {
  const { data, error } = await client()
    .from('records')
    .select('*, demons(name, position), profiles(username)')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Staff only. status is 'approved' or 'rejected'; rejectReason optional. */
export async function reviewRecord(id, { status, rejectReason }) {
  const user = await getCurrentUser();
  const { data, error } = await client()
    .from('records')
    .update({
      status,
      reject_reason: rejectReason ?? null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// LEADERBOARD & PROFILES
// ----------------------------------------------------------------------------

/** Global leaderboard, highest points first. */
export async function getLeaderboard() {
  const { data, error } = await client().from('leaderboard').select('*');
  if (error) throw error;
  return data;
}

export async function getPlayerProfile(username) {
  const { data, error } = await client().from('profiles').select('*').eq('username', username).single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// ADMIN: user management
// ----------------------------------------------------------------------------

/** Admin only. role is 'user' | 'moderator' | 'admin'. */
export async function setUserRole(userId, role) {
  const { data, error } = await client().from('profiles').update({ role }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

/** Admin only. */
export async function setUserBanned(userId, banned) {
  const { data, error } = await client().from('profiles').update({ banned }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}
