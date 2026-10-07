import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Supabase connection
// ----------------------------------------------------------------------------
// Supabase is the boutique's database, not a mirror of one. Accounts live in
// `auth.users` with their role and permission matrix in `public.profiles`, the
// business rows live in the tables described by `supabase/`, and the images
// live in the four public buckets. Nothing is kept on the device.
//
// The client is created only when both variables are present, so a checkout
// without an `.env` still boots and can say what is missing instead of
// throwing at module load.
// ============================================================================

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The storefront and the back office share one origin, so one key is
        // enough; naming it explicitly keeps it out of the way of other apps.
        storageKey: 'atelier-mode.auth',
      },
    })
  : null

/** The row `public.profiles` holds for every account, staff included. */
export interface ProfileRow {
  id: string
  full_name: string
  username: string
  email: string
  role: string
  is_admin: boolean
  /** `"ALL"` for the owner, otherwise the module/action matrix. */
  permissions: unknown
  active: boolean
}

const PROFILE_COLUMNS = 'id, full_name, username, email, role, is_admin, permissions, active'

/** What went wrong, in the language the interface speaks. */
export class AuthError extends Error {}

/**
 * Sign in against Supabase.
 *
 * Returns `null` when the credentials are rejected, and throws when the account
 * is real but unusable — deactivated, or without a profile row — so the login
 * screen can tell the two apart instead of showing "wrong password" to someone
 * whose access was simply revoked.
 */
export const signInWithSupabase = async (
  email: string,
  password: string,
): Promise<ProfileRow | null> => {
  if (!supabase) throw new AuthError('supabase-not-configured')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) {
    await supabase.auth.signOut()
    throw new AuthError(profileError.message)
  }
  if (!profile) {
    await supabase.auth.signOut()
    throw new AuthError('no-profile')
  }
  if (profile.active === false) {
    await supabase.auth.signOut()
    throw new AuthError('account-disabled')
  }
  return profile as ProfileRow
}

/** What the stored Supabase session amounts to when the app boots again. */
export type SessionCheck =
  | { status: 'ok'; profile: ProfileRow }
  | { status: 'signed-out' }
  | { status: 'unreachable' }

/**
 * Re-read the session Supabase kept in local storage and load its profile.
 *
 * Called on every boot so a refresh keeps the user signed in. A revoked or
 * deactivated account resolves to `signed-out`; a network failure resolves to
 * `unreachable`, which the caller treats as "wait rather than sign out" — a
 * flaky connection must not throw someone back to the login screen.
 */
export const getSessionProfile = async (): Promise<SessionCheck> => {
  if (!supabase) return { status: 'signed-out' }
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return { status: 'unreachable' }

    const user = data.session?.user
    if (!user) return { status: 'signed-out' }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) return { status: 'unreachable' }
    if (!profile || profile.active === false) return { status: 'signed-out' }
    return { status: 'ok', profile: profile as ProfileRow }
  } catch {
    return { status: 'unreachable' }
  }
}

/**
 * Does the boutique already have an owner?
 *
 * Answered by the `admin_exists()` RPC, which is `security definer` so the
 * login screen can ask it before anyone has signed in. It returns a bare
 * boolean — an anonymous visitor learns that the boutique is claimed and
 * nothing else. This is what retires the "create administrator" button.
 *
 * Returns `null` when the question cannot be answered (offline, project
 * unreachable): the caller keeps the button hidden rather than inviting a
 * signup that would fail.
 */
export const adminExistsInSupabase = async (): Promise<
  { ok: true; exists: boolean } | { ok: false; message: string }
> => {
  if (!supabase) return { ok: false, message: 'supabase-not-configured' }
  try {
    const { data, error } = await supabase.rpc('admin_exists')
    // A missing function means the SQL in `supabase/` has not been run against
    // this project yet. That is worth saying out loud on the login screen, or
    // the owner is left staring at a form with no way to create their account.
    if (error) return { ok: false, message: error.message }
    return { ok: true, exists: Boolean(data) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'unreachable' }
  }
}

export interface SignUpResult {
  ok: boolean
  /** Set when Supabase issued a session straight away. */
  signedIn?: boolean
  message?: string
}

/**
 * Register the owner account in `auth.users`.
 *
 * The `handle_new_user` trigger writes the matching `profiles` row and makes
 * the very first account an administrator whatever the metadata says, so
 * nothing is inserted here. A project with e-mail confirmation switched on
 * creates the user without a session — reported back as `signedIn: false` so
 * the screen can ask the owner to confirm and sign in.
 */
export const signUpAdminWithSupabase = async (data: {
  email: string
  password: string
  fullName: string
  username: string
}): Promise<SignUpResult> => {
  if (!supabase) return { ok: false, message: 'supabase-not-configured' }

  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { full_name: data.fullName, username: data.username, is_admin: true },
    },
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, signedIn: Boolean(result.session) }
}

/**
 * Create the auth account for a member of staff, without disturbing the owner.
 *
 * `signUp` on the shared client would swap the new user's session in for the
 * owner's and sign them out of their own boutique. So the call is made on a
 * throwaway client that persists nothing: the account and its profile are
 * created by the trigger, the session it returns is dropped on the floor, and
 * the owner's tab carries on as it was.
 *
 * The worker's id travels in the metadata, which is what tells
 * `handle_new_user` to copy that worker's permission matrix onto the profile
 * and flip `workers.has_account`.
 */
export const provisionWorkerAccount = async (data: {
  email: string
  password: string
  fullName: string
  username: string
  workerId: string
  role: string
}): Promise<SignUpResult> => {
  if (!isSupabaseConfigured) return { ok: false, message: 'supabase-not-configured' }

  const isolated = createClient(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await isolated.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        username: data.username,
        worker_id: data.workerId,
        role: data.role,
      },
    },
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export const signOutFromSupabase = async (): Promise<void> => {
  await supabase?.auth.signOut()
}

/** Public URL of a file in one of the storefront's buckets. */
export const publicAssetUrl = (bucket: string, path: string): string => {
  if (!supabase || !path) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
