import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

const ConfirmContext = createContext(null);

const INITIAL_STATE = {
  open: false,
  mode: 'confirm',
  title: '',
  description: '',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  confirmVariant: 'danger',
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const resolveRef = useRef(null);

  const confirm = useCallback(({
    title,
    description,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    confirmVariant = 'danger',
  }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        mode: 'confirm',
        title,
        description,
        confirmLabel,
        cancelLabel,
        confirmVariant,
      });
    });
  }, []);

  const alert = useCallback(({
    title,
    description,
    confirmLabel = 'OK',
    confirmVariant = 'primary',
  }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        mode: 'alert',
        title,
        description,
        confirmLabel,
        cancelLabel: 'Cancel',
        confirmVariant,
      });
    });
  }, []);

  const handleConfirm = () => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  };

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={state.open}
        mode={state.mode}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        confirmVariant={state.confirmVariant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx.confirm;
}

export function useAlert() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useAlert must be used within <ConfirmProvider>');
  return ctx.alert;
}
