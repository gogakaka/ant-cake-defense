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
    installStageSwipe();
    guardCanvasGestures();
  });

  /**
   * Swipe-to-move for the whole stage.
   * A finger drag across the board translates the stage via CSS transform.
   * Tap-to-place still works: we only commit to drag after the finger moves
   * past a small distance threshold, and on drag-end we preventDefault so the
   * synthesized mousedown/click doesn't fire on whatever cell the finger
   * lifted over. Free-form — no snap, no viewport clamp. Position persists.
   */
  const STORAGE_KEY = 'acd.stage-offset';
  const DRAG_THRESHOLD = 10; // viewport pixels

  let dragState = null;

  function getStage() { return document.getElementById('stage'); }

  function loadOffset() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { x: 0, y: 0 };
      const v = JSON.parse(raw);
      return { x: Number(v.x) || 0, y: Number(v.y) || 0 };
    } catch { return { x: 0, y: 0 }; }
  }

  function saveOffset(x, y) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })); } catch {}
  }

  function applyOffset(x, y) {
    const stage = getStage();
    if (!stage) return;
    stage.style.transform = (x || y) ? `translate(${x}px, ${y}px)` : '';
  }

  // Don't hijack taps on HUD buttons, popup/overlay controls, etc.
  function isInteractiveTarget(t) {
    return !!(t && t.closest && t.closest(
      'button, a, input, select, textarea, .popup, .overlay-card, #start-screen'
    ));
  }

  function findTouch(list, id) {
    for (const t of list) if (t.identifier === id) return t;
    return null;
  }

  function installStageSwipe() {
    const stage = getStage();
    if (!stage) return;

    const initial = loadOffset();
    applyOffset(initial.x, initial.y);

    stage.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    stage.addEventListener('touchmove',   onTouchMove,   { passive: false });
    stage.addEventListener('touchend',    onTouchEnd,    { passive: false });
    stage.addEventListener('touchcancel', onTouchCancel, { passive: true  });
  }

  function onTouchStart(e) {
    // Multi-touch (pinch etc.) — bail.
    if (e.touches.length !== 1) { dragState = null; return; }
    if (isInteractiveTarget(e.target)) { dragState = null; return; }
    const t = e.touches[0];
    const base = loadOffset();
    dragState = {
      id: t.identifier,
      startX: t.clientX,
      startY: t.clientY,
      baseX: base.x,
      baseY: base.y,
      dragging: false,
    };
  }

  function onTouchMove(e) {
    if (!dragState) return;
    const t = findTouch(e.touches, dragState.id);
    if (!t) return;
    const dx = t.clientX - dragState.startX;
    const dy = t.clientY - dragState.startY;
    if (!dragState.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragState.dragging = true;
      getStage()?.classList.add('dragging');
    }
    e.preventDefault();
    applyOffset(dragState.baseX + dx, dragState.baseY + dy);
  }

  function onTouchEnd(e) {
    if (!dragState) return;
    const t = findTouch(e.changedTouches, dragState.id);
    if (!t) { dragState = null; return; }
    if (dragState.dragging) {
      // Suppress the synthesized mousedown/click so the game doesn't treat
      // the end of a swipe as a tap on whatever cell the finger lifted over.
      e.preventDefault();
      const dx = t.clientX - dragState.startX;
      const dy = t.clientY - dragState.startY;
      saveOffset(dragState.baseX + dx, dragState.baseY + dy);
      getStage()?.classList.remove('dragging');
    }
    dragState = null;
  }

  function onTouchCancel() {
    if (dragState?.dragging) getStage()?.classList.remove('dragging');
    dragState = null;
  }

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
