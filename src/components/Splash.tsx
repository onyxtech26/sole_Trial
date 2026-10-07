import { C } from '../ui/kit';
import { COMPANY } from '../lib/config';

/** The brand hold shown while the session is restored and the first read lands. */
export function Splash() {
  return (
    <div
      className="fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 90, background: C.paper,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 18,
      }}
    >
      <div
        className="splash-mark"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11 }}
      >
        <span style={{
          width: 52, height: 52, borderRadius: 12, background: C.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <img src="/logo-mark.png" alt="" style={{ height: 22, width: 'auto', display: 'block' }} />
        </span>
        <img src="/logo.png" alt="SOLE" style={{ height: 20, width: 'auto', display: 'block' }} />
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.muted3,
        }}>
          {COMPANY} · Operations
        </span>
      </div>

      <div style={{
        width: 168, height: 3, borderRadius: 2, background: C.line, overflow: 'hidden',
      }}>
        <div className="track" style={{ height: '100%', borderRadius: 2, background: C.ink }} />
      </div>
    </div>
  );
}
