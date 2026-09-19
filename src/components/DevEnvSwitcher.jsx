import { ENV_STATES, setDevEnvState } from '../lib/environment';

// Hidden unless explicitly enabled. Set VITE_SHOW_ENV_DEBUG=true in .env.local
// (or the shell) to get the environment preview buttons; they are absent from
// any build that doesn't set it, production included.
const SHOW = import.meta.env.VITE_SHOW_ENV_DEBUG === 'true';

export default function DevEnvSwitcher({ envState }) {
  if (!SHOW) return null;

  return (
    <div className="dev-env-switcher" title="Debug only — environment preview">
      {ENV_STATES.map((s) => (
        <button
          key={s}
          type="button"
          className={s === envState ? 'active' : ''}
          onClick={() => setDevEnvState(s)}
        >
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
