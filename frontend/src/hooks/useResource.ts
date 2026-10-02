import { useEffect, useState, useCallback, useRef } from 'react';
import { api, ApiError } from '../services/api';
export function useResource<T>(path: string, poll = 0, enabled = true) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const sequence = useRef(0),
    currentPath = useRef(path);
  currentPath.current = path;
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++sequence.current;
    try {
      const result = await api<T>(path);
      if (id !== sequence.current || path !== currentPath.current) return;
      setData(result);
      setError('');
    } catch (e) {
      if (id === sequence.current && path === currentPath.current) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        if (
          e instanceof ApiError &&
          e.status === 401 &&
          window.location.pathname.startsWith('/crm') &&
          !window.location.pathname.endsWith('/login')
        )
          window.location.href = '/crm/login';
      }
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [path, enabled]);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setData(null);
    void refresh();
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    if (poll) document.addEventListener('visibilitychange', visible);
    const timer = poll
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') void refresh();
        }, poll)
      : undefined;
    return () => {
      sequence.current++;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, poll, enabled]);
  return { data, error, loading, refresh, setData };
}
export function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
