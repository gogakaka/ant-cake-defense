/* =========================================================================
   Mobile runtime enhancements
   - No-op on desktop. Only activates when a coarse pointer OR narrow viewport
     is detected, OR when forced via ?mobile=1 query param.
   - Does NOT modify game logic (game.js). Only adds a root-level class,
     injects a rotation overlay, and suppresses iOS gesture zoom on canvas.
   - Tap input continues to work through the browser's synthesized mousedown
     events — no new game handlers needed.
   ========================================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const forceMobile = query.get('mobile') === '1';
  const forceDesktop = query.get('mobile') === '0';

  const mql = window.matchMedia('(pointer: coarse), (max-width: 900px)');

  const applyClass = () => {
    const isMobile = forceMobile || (!forceDesktop && mql.matches);
    root.classList.toggle('is-mobile', isMobile);
  };
  applyClass();

  if (mql.addEventListener) {
    mql.addEventListener('change', applyClass);
  } else if (mql.addListener) {
    // Safari < 14 fallback
    mql.addListener(applyClass);
  }

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  onReady(() => {
    ensureRotatePrompt();
    guardCanvasGestures();
  });

  /**
   * Inject the portrait rotation prompt if not already present in the HTML.
   * CSS in mobile.css handles show/hide via media queries.
   */
  function ensureRotatePrompt() {
    if (document.getElementById('rotate-prompt')) return;
    const el = document.createElement('div');
    el.id = 'rotate-prompt';
    el.innerHTML = `
      <div class="rotate-card">
        <div class="rotate-icon">📱</div>
        <div class="rotate-title">가로 모드로 돌려주세요</div>
        <div class="rotate-sub">Ant Cake Defense 는 가로 화면에 최적화되어 있어요.<br>
          기기를 가로로 눕히면 바로 시작할 수 있습니다.</div>
      </div>`;
    document.body.appendChild(el);
  }

  /**
   * Prevent iOS Safari pinch-zoom gestures on the canvas and swallow the
   * native double-tap zoom. Synthesized `mousedown` for single taps is
   * preserved so game.js input keeps working untouched.
   */
  function guardCanvasGestures() {
    const canvas = document.getElementById('game');
    if (!canvas) return;

    const preventIfTouch = (e) => e.preventDefault();
    // iOS-only gesture events (pinch zoom).
    canvas.addEventListener('gesturestart',  preventIfTouch, { passive: false });
    canvas.addEventListener('gesturechange', preventIfTouch, { passive: false });
    canvas.addEventListener('gestureend',    preventIfTouch, { passive: false });

    // Double-tap zoom guard: if two taps land within 350ms, cancel the 2nd.
    let lastTouchEnd = 0;
    canvas.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }
})();
