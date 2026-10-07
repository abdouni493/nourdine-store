import { create } from 'zustand'
import type { AppUser, Permissions } from '@/types'
import {
  supabase,
  adminExistsInSupabase,
  getSessionProfile,
  isSupabaseConfigured,
  signInWithSupabase,
  signOutFromSupabase,
  signUpAdminWithSupabase,
  AuthError,
  type ProfileRow,
} from '@/lib/supabase'

// ============================================================================
// Accounts
// ----------------------------------------------------------------------------
// Every account is a row in Supabase `auth.users`, with its role and permission
// matrix in `public.profiles`. There is no on-device account list and no
// fallback password check: if Supabase says no, the answer is no.
//
// The session itself is kept by the Supabase client in local storage under
// `atelier-mode.auth`, which is what survives a refresh. This store holds the
// profile that session resolves to, re-read on every boot.
// ============================================================================

/** A Supabase profile row, rendered in the shape the interface consumes. */
const profileAsUser = (p: ProfileRow): AppUser => ({
  id: p.id,
  fullName: p.full_name || p.email,
  username: p.username ?? '',
  email: p.email,
  // Credentials never leave `auth.users`.
  password: '',
  role: p.role,
  permissions: (p.is_admin ? 'ALL' : ((p.permissions ?? {}) as Permissions)) as AppUser['permissions'],
})

/** Why a sign-in attempt failed, so the screen can say something useful. */
export type LoginOutcome =
  | { ok: true; user: AppUser }
  | { ok: false; reason: 'not-configured' | 'bad-credentials' | 'disabled' | 'error'; message?: string }

interface AuthState {
  currentUser: AppUser | null
  /**
   * Whether the boutique already has an owner. `null` until the question has
   * been asked — the create-admin flow stays hidden while it is unknown, so it
   * can never flash on screen for a boutique that is already claimed.
   */
  adminExists: boolean | null
  /**
   * Why the boutique could not be questioned, when it could not be. Set when
   * the project is unreachable or the SQL in `supabase/` has never been run —
   * the login screen shows it rather than offering a form that cannot work.
   */
  dbError: string | null
  /** True while the stored session is being revalidated on boot. */
  restoring: boolean

  login: (email: string, password: string) => Promise<LoginOutcome>
  /** Re-read the stored Supabase session and its profile. Runs on every boot. */
  restoreSession: () => Promise<void>
  /** Ask Supabase whether an administrator has been registered. */
  refreshAdminExists: () => Promise<void>
  createAdmin: (data: {
    fullName: string
    username: string
    email: string
    password: string
  }) => Promise<{ ok: boolean; signedIn: boolean; message?: string }>
  logout: () => Promise<void>
  /**
   * Edit the signed-in account. The display fields go to `public.profiles`; a
   * new e-mail or password goes to `auth.users`, which is the only place a
   * credential is ever stored.
   */
  updateAccount: (data: {
    fullName?: string
    username?: string
    email?: string
    password?: string
  }) => Promise<{ ok: boolean; message?: string }>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  adminExists: null,
  dbError: null,
  restoring: true,

  login: async (email, password) => {
    if (!isSupabaseConfigured) return { ok: false, reason: 'not-configured' }

    try {
      const profile = await signInWithSupabase(email.trim(), password)
      if (!profile) return { ok: false, reason: 'bad-credentials' }
      const user = profileAsUser(profile)
      set({ currentUser: user, adminExists: true })
      return { ok: true, user }
    } catch (e) {
      if (e instanceof AuthError && e.message === 'account-disabled') {
        return { ok: false, reason: 'disabled' }
      }
      return { ok: false, reason: 'error', message: e instanceof Error ? e.message : undefined }
    }
  },

  restoreSession: async () => {
    if (!isSupabaseConfigured) {
      set({ currentUser: null, restoring: false })
      return
    }
    const check = await getSessionProfile()
    if (check.status === 'ok') set({ currentUser: profileAsUser(check.profile), adminExists: true })
    else if (check.status === 'signed-out') set({ currentUser: null })
    // `unreachable` keeps whatever was already there: a flaky connection must
    // not sign anyone out.
    set({ restoring: false })
  },

  refreshAdminExists: async () => {
    const result = await adminExistsInSupabase()
    if (result.ok) set({ adminExists: result.exists, dbError: null })
    else set({ adminExists: null, dbError: result.message })
  },

  createAdmin: async ({ fullName, username, email, password }) => {
    if (!isSupabaseConfigured) {
      return { ok: false, signedIn: false, message: 'supabase-not-configured' }
    }

    const result = await signUpAdminWithSupabase({ email, password, fullName, username })
    if (!result.ok) return { ok: false, signedIn: false, message: result.message }

    // The account now exists, so the create-admin flow retires itself whether
    // or not the project handed back a session.
    set({ adminExists: true })

    if (result.signedIn) {
      const check = await getSessionProfile()
      if (check.status === 'ok') set({ currentUser: profileAsUser(check.profile) })
    }
    return { ok: true, signedIn: Boolean(result.signedIn) }
  },

  logout: async () => {
    await signOutFromSupabase()
    set({ currentUser: null })
    // The owner still exists; only this session ended.
    void get().refreshAdminExists()
  },

  updateAccount: async ({ fullName, username, email, password }) => {
    const user = get().currentUser
    if (!user) return { ok: false, message: 'not-signed-in' }
    if (!supabase) return { ok: false, message: 'supabase-not-configured' }

    try {
      const profilePatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (fullName !== undefined) profilePatch.full_name = fullName
      if (username !== undefined) profilePatch.username = username || null
      if (email !== undefined) profilePatch.email = email

      if (Object.keys(profilePatch).length > 1) {
        const { error } = await supabase.from('profiles').update(profilePatch).eq('id', user.id)
        if (error) throw new Error(error.message)
      }

      // A credential change is an `auth.users` write, not a profile write.
      const credentials: { email?: string; password?: string } = {}
      if (email && email !== user.email) credentials.email = email
      if (password) credentials.password = password
      if (Object.keys(credentials).length) {
        const { error } = await supabase.auth.updateUser(credentials)
        if (error) throw new Error(error.message)
      }

      set({
        currentUser: {
          ...user,
          fullName: fullName ?? user.fullName,
          username: username ?? user.username,
          email: email ?? user.email,
        },
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'update-failed' }
    }
  },
}))

/** The signed-in account's permissions, or `null` when nobody is signed in. */
export const currentPermissions = (): AppUser['permissions'] | null =>
  useAuthStore.getState().currentUser?.permissions ?? null
