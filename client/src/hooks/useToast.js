/*
 * Toast state + auto-dismiss helpers.
 */
import { useCallback, useRef, useState } from "react";

const createId = () =>
  `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useToast = (timeoutMs = 3500) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ type = "info", title = "", message }) => {
      const id = createId();
      setToasts((prev) => [...prev, { id, type, title, message }]);
      const timer = setTimeout(() => dismissToast(id), timeoutMs);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismissToast, timeoutMs],
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  return { toasts, pushToast, dismissToast, clearToasts };
};
