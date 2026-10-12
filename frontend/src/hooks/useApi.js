import { useState, useEffect, useCallback } from "react";

// Generic loader: pass a function returning a promise; get {data,loading,error,reload}.
// `raw` is the whole response, for the paging fields (total, pages) next to `data`.
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      setRaw(res);
      // unwrap {ok,data} envelope when present
      setData(res && Object.prototype.hasOwnProperty.call(res, "data") ? res.data : res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { data, raw, loading, error, reload: load, setData };
}
