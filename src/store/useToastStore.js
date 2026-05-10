import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],
  pushToast: ({ kind = 'info', message, duration = 4000 } = {}) => {
    if (!message) return;
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  error: (message, opts = {}) => useToastStore.getState().pushToast({ kind: 'error', message, ...opts }),
  success: (message, opts = {}) => useToastStore.getState().pushToast({ kind: 'success', message, ...opts }),
  info: (message, opts = {}) => useToastStore.getState().pushToast({ kind: 'info', message, ...opts }),
};
