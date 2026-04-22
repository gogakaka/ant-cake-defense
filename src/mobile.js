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
    ensureStageGrip();
    guardCanvasGestures();
  });

  /**
   * Free-form stage repositioning.
   * The HUD buttons often get crowded against the screen edges on phones.
   * A floating grip lets the player drag the whole stage to wherever feels
   * comfortable — no snap back, no viewport clamp. Position persists.
   */
  const STORAGE_KEY = 'acd.stage-offset';
  let gripDrag = null;

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

  function ensureStageGrip() {
    if (document.getElementById('stage-grip')) return;
    const btn = document.createElement('button');
    btn.id = 'stage-grip';
    btn.type = 'button';
    btn.setAttribute('aria-label', '게임 화면 이동 (더블탭으로 원위치)');
    btn.title = '드래그하여 이동 · 더블탭으로 원위치';
    btn.innerHTML = `
      <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="5" r="1.5"/><circle cx="10" cy="5" r="1.5"/><circle cx="14" cy="5" r="1.5"/>
        <circle cx="6" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="14" cy="10" r="1.5"/>
        <circle cx="6" cy="15" r="1.5"/><circle cx="10" cy="15" r="1.5"/><circle cx="14" cy="15" r="1.5"/>
      </svg>`;
    document.body.appendChild(btn);

    const initial = loadOffset();
    applyOffset(initial.x, initial.y);

    btn.addEventListener('pointerdown', onGripDown);
    btn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      applyOffset(0, 0);
      saveOffset(0, 0);
    });
  }

  function onGripDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const btn = e.currentTarget;
    const base = loadOffset();
    gripDrag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: base.x,
      baseY: base.y,
      moved: false,
    };
    btn.classList.add('dragging');
    try { btn.setPointerCapture(e.pointerId); } catch {}
    btn.addEventListener('pointermove', onGripMove);
    btn.addEventListener('pointerup', onGripUp);
    btn.addEventListener('pointercancel', onGripUp);
  }

  function onGripMove(e) {
    if (!gripDrag || e.pointerId !== gripDrag.id) return;
    const dx = e.clientX - gripDrag.startX;
    const dy = e.clientY - gripDrag.startY;
    if (!gripDrag.moved && Math.hypot(dx, dy) > 2) gripDrag.moved = true;
    applyOffset(gripDrag.baseX + dx, gripDrag.baseY + dy);
  }

  function onGripUp(e) {
    if (!gripDrag || e.pointerId !== gripDrag.id) return;
    const btn = e.currentTarget;
    const dx = e.clientX - gripDrag.startX;
    const dy = e.clientY - gripDrag.startY;
    if (gripDrag.moved) saveOffset(gripDrag.baseX + dx, gripDrag.baseY + dy);
    btn.classList.remove('dragging');
    try { btn.releasePointerCapture?.(e.pointerId); } catch {}
    btn.removeEventListener('pointermove', onGripMove);
    btn.removeEventListener('pointerup', onGripUp);
    btn.removeEventListener('pointercancel', onGripUp);
    gripDrag = null;
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
