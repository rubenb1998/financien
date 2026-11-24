import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.ts';
import { rememberedPreference } from '../domain/ai.ts';
import type { AiChatMessage, AiMemoryNote, AiPageContext, AiSelection, AiSettings, AiStatus } from '../domain/ai.ts';

export function useAiConversation(settings: AiSettings, active: boolean, reload: () => Promise<void>, pageContext: AiPageContext) {
  const [statuses, setStatuses] = useState<AiStatus[]>([]);
  const [checking, setChecking] = useState<AiSelection | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [memory, setMemory] = useState<AiMemoryNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [allowChanges, setAllowChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>(null);
  const activeStatus = statuses.find(status => status.provider === settings.provider);
  const canRemember = Boolean(rememberedPreference(draft));
  const connected = activeStatus?.state === 'ready' && !activeStatus.signingIn;
  const refresh = useCallback(async () => {
    const current = await api.aiStatus();
    setStatuses(current);
    return current;
  }, []);

  const connect = useCallback(async (selection: AiSelection) => {
    setChecking(selection);
    try {
      const check = await api.aiConnect(selection);
      setStatuses(current => current.map(status => status.provider === selection.provider ? { ...status, check } : status));
      await refresh().catch(() => undefined);
      return check;
    } finally {
      setChecking(null);
    }
  }, [refresh]);

  useEffect(() => {
    if (active) void refresh().catch(() => setError('CLI-status ophalen is mislukt.'));
  }, [active, refresh]);

  useEffect(() => {
    if (!active || loaded) return;
    let subscribed = true;
    void api.chat().then(value => {
      if (!subscribed) return;
      setMessages(value.messages);
      setCanUndo(value.canUndo);
      setMemory(value.memory ?? []);
      setLoaded(true);
    }).catch(() => {
      if (subscribed) setError('Het gesprek kon niet worden geladen. Open de chat opnieuw.');
    });
    return () => { subscribed = false; };
  }, [active, loaded]);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (!active || (!checking && !statuses.some(status => status.signingIn))) return;
    const timer = setTimeout(() => void refresh().catch(() => setError('Vernieuw de CLI-status om je aanmelding te controleren.')), 1_200);
    return () => clearTimeout(timer);
  }, [active, checking, statuses, refresh]);

  async function send() {
    const text = draft.trim();
    if (!loaded || (!connected && !canRemember) || !text || request.current || busy || checking) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setDraft('');
    setError('');
    setPendingText(text);
    try {
      const result = await api.sendChat(text, allowChanges, pageContext, controller.signal);
      setMessages(result.messages);
      setCanUndo(result.canUndo);
      if (result.memory) setMemory(result.memory);
      if (result.changed) await reload().catch(() => setError('De wijziging is opgeslagen. Herlaad het dashboard om die te zien.'));
    } catch (failure) {
      setDraft(current => current || text);
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Het bericht kon niet worden verwerkt.');
    } finally {
      void refresh().catch(() => undefined);
      setPendingText('');
      setBusy(false);
      request.current = null;
    }
  }

  async function clear() {
    setError('');
    setBusy(true);
    try {
      const result = await api.clearChat();
      setMessages(result.messages);
      setCanUndo(result.canUndo);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Het gesprek kon niet worden gewist.');
    } finally { setBusy(false); }
  }

  async function forget(id: number) {
    if (busy) return;
    setError('');
    setBusy(true);
    try { setMemory(await api.forget(id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Verwijderen uit het geheugen is mislukt.'); }
    finally { setBusy(false); }
  }

  async function undo() {
    setError('');
    setBusy(true);
    try {
      const result = await api.undoAi();
      setCanUndo(false);
      await reload();
      if (result.skipped) setError('Een daarna bewerkte boeking is behouden.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Ongedaan maken is mislukt.');
    } finally { setBusy(false); }
  }

  return {
    statuses, refresh, checking, connect, connected, canRemember, pageContext, loaded, messages, memory, forget, canUndo, draft, setDraft, pendingText, allowChanges,
    setAllowChanges, busy, error, send, clear, undo, stop: () => request.current?.abort(),
  };
}

export type AiConversation = ReturnType<typeof useAiConversation>;
