import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data for a page. `load` runs whenever `deps` change or reload() is called.
 * Returns { data, error, loading, reload, setData }. Loading is derived from
 * whether the latest request has answered, so no state is set synchronously.
 */
export default function useAsync(load, deps) {
  const [nonce, setNonce] = useState(0);
  const requestKey = `${JSON.stringify(deps)}#${nonce}`;
  const [state, setState] = useState({ answered: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ answered: requestKey, data, error: null }),
      (error) => active && setState({ answered: requestKey, data: null, error }),
    );
    return () => {
      active = false;
    };
    // `load` is a fresh closure each render; `requestKey` captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })),
    [],
  );

  return { data: state.data, error: state.error, loading: state.answered !== requestKey, reload, setData };
}
