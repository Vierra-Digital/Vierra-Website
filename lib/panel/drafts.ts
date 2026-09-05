type Draft = { scope: string; label: string; busy: boolean };
const drafts = new Map<symbol, Draft>();

export function registerDraft(key: symbol, draft: Draft) {
  drafts.set(key, draft);
  return () => { drafts.delete(key); };
}

export function draftState(scope?: string) {
  const matching = [...drafts.values()].filter(draft => !scope || draft.scope === scope);
  return { dirty: matching.length > 0, busy: matching.some(draft => draft.busy), labels: [...new Set(matching.map(draft => draft.label))] };
}

export function confirmDiscardDrafts(scope?: string): boolean {
  const state = draftState(scope);
  if (!state.dirty) return true;
  if (state.busy) {
    window.alert("A save is still in progress. Wait for it to finish before leaving or refreshing.");
    return false;
  }
  return window.confirm(`Unsaved changes in ${state.labels.join(", ")}. Leave and discard these changes?`);
}
