import toast from 'react-hot-toast'

// ============================================================================
// Firing a write from an event handler
// ----------------------------------------------------------------------------
// Every store mutation is a round trip to Supabase now, so each one can fail:
// the row is refused by a policy, the column rejects the value, the line is
// down. A click handler cannot await, and an unhandled rejection would leave
// the interface showing a change the database never accepted — the exact
// failure mode this refactor exists to remove.
//
// So writes are fired through here: the promise is always handled, and a
// failure always reaches the user as the message the database actually gave.
// ============================================================================

interface CommitMessages {
  /** Shown only when the write succeeded. */
  success?: string
  /** Fallback when the error carries no message of its own. */
  failure?: string
}

export const commit = (work: Promise<unknown>, messages: CommitMessages = {}): void => {
  void work.then(
    () => {
      if (messages.success) toast.success(messages.success)
    },
    (error: unknown) => {
      const detail = error instanceof Error ? error.message : ''
      toast.error(detail || messages.failure || 'Erreur')
    },
  )
}
