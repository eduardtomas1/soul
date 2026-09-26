import { useCallback, useEffect, useRef, useState } from "react";
import type { DataScope, IpcChannel, IpcInput, IpcOutput } from "@shared/ipc";
import { invoke, subscribe } from "./bridge";

interface QueryState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
}

export interface QueryResult<T> extends QueryState<T> {
  readonly reload: () => void;
}

export function useQuery<C extends IpcChannel>(
  channel: C,
  input: IpcInput<C>,
  scopes: readonly DataScope[],
): QueryResult<IpcOutput<C>> {
  const [state, setState] = useState<QueryState<IpcOutput<C>>>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(input ?? null);
  const scopesKey = scopes.join("|");
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    let cancelled = false;
    const current: unknown = key === "null" ? undefined : JSON.parse(key);
    const args = (current === undefined ? [] : [current]) as IpcInput<C> extends void ? [] : [IpcInput<C>];
    invoke(channel, ...args)
      .then((data) => {
        if (!cancelled && ticket === latest.current) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled && ticket === latest.current) {
          setState((previous) => ({ data: previous.data, error: error instanceof Error ? error.message : "Something went wrong.", loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [channel, key, version]);

  useEffect(() => {
    if (scopesKey.length === 0) return undefined;
    const watched = new Set(scopesKey.split("|"));
    return subscribe<{ scope: DataScope }>("data.changed", ({ scope }) => {
      if (scope === "all" || watched.has(scope)) setVersion((current) => current + 1);
    });
  }, [scopesKey]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
}

export function useMutation<C extends IpcChannel>(channel: C) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...args: IpcInput<C> extends void ? [] : [IpcInput<C>]): Promise<IpcOutput<C> | null> => {
    setPending(true);
    setError(null);
    try {
      return await invoke(channel, ...args);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      return null;
    } finally {
      setPending(false);
    }
  }, [channel]);
  return { run, pending, error, clearError: () => setError(null) };
}
