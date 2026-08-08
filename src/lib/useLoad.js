import { useCallback, useEffect, useState } from 'react'

/**
 * Loading, failing, and trying again.
 *
 * Every screen used to do this:
 *
 *     async function load() {
 *       setRows(await listThings())
 *       setLoading(false)
 *     }
 *
 * which is fine until listThings() throws. Then setLoading(false)
 * never runs, the rejection goes nowhere, and the screen sits on
 * "Loading…" for as long as the person is willing to wait. No error,
 * no retry, nothing to do but reload the page — and on a phone with a
 * patchy connection that is not a rare case, it is Tuesday.
 *
 * So: the spinner always ends, a failure always says so, and there is
 * always a button to try again.
 */
export function useLoad(loadFn, deps = []) {
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    setLoading(true)
    setFailure(null)
    try {
      await loadFn()
    } catch (caught) {
      setFailure(caught)
    } finally {
      // finally, not the happy path — this is the whole point.
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { loading, failure, retry: run }
}
