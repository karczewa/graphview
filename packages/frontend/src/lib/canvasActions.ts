// Module-level registry for imperative canvas actions.
// GraphCanvas registers implementations; Toolbar and keyboard handler call them.
type Action = () => void;

const registry: Record<string, Action> = {};

export const canvasActions = {
  register: (name: string, fn: Action) => { registry[name] = fn; },
  unregister: (name: string) => { delete registry[name]; },
  call: (name: string) => registry[name]?.(),
};
