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
   * Gesture handling for the stage:
   *   - 1 finger  → pan (translate). Tap-to-place still fires when movement
   *                  stays under DRAG_THRESHOLD.
   *   - 2 fingers → pinch-zoom. The stage-local point under the pinch
   *                  midpoint stays anchored as scale changes, so the board
   *                  zooms around the fingers rather than the top-left.
   * Transform uses `transform-origin: 0 0` (set in CSS) so tx/ty are plain
   * viewport pixel offsets regardless of scale. Free-form — no snap, no
   * viewport clamp. Scale clamps only to keep the layout usable. Persisted.
   */
  const STORAGE_KEY = 'acd.stage-transform';
  const DRAG_THRESHOLD = 10;  // viewport pixels — below this, a tap still fires
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  let gesture = null;
  let current = { tx: 0, ty: 0, scale: 1 };

  function getStage() { return document.getElementById('stage'); }

  function clampScale(s) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }

  function loadTransform() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { tx: 0, ty: 0, scale: 1 };
      const v = JSON.parse(raw);
      return {
        tx: Number(v.tx) || 0,
        ty: Number(v.ty) || 0,
        scale: clampScale(Number(v.scale) || 1),
      };
    } catch { return { tx: 0, ty: 0, scale: 1 }; }
  }

  function saveTransform(t) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {}
  }

  function applyTransform(t) {
    const stage = getStage();
    if (!stage) return;
    const identity = t.tx === 0 && t.ty === 0 && t.scale === 1;
    stage.style.transform = identity
      ? ''
      : `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`;
  }

  function setTransform(t) {
    current = t;
    applyTransform(t);
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

  /**
   * Build a fresh gesture baseline from the current touch set. Called on
   * every touch count change so ongoing gestures pick up cleanly when a
   * second finger lands mid-pan, or one lifts mid-pinch.
   */
  function snapshot(touches) {
    if (touches.length === 0) return null;
    if (touches.length === 1) {
      const t = touches[0];
      return {
        mode: 'pan',
        id: t.identifier,
        startX: t.clientX, startY: t.clientY,
        baseTx: current.tx, baseTy: current.ty, baseScale: current.scale,
        dragging: false,
      };
    }
    const a = touches[0], b = touches[1];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const rect = getStage().getBoundingClientRect();
    return {
      mode: 'pinch',
      ida: a.identifier, idb: b.identifier,
      startDist: dist,
      startMidX: midX, startMidY: midY,
      startScale: current.scale,
      baseTx: current.tx, baseTy: current.ty,
      // Natural (pre-transform) top-left of the stage in viewport coords —
      // held constant through the gesture so anchoring math stays stable.
      natLeft: rect.left - current.tx,
      natTop:  rect.top  - current.ty,
    };
  }

  function installStageSwipe() {
    const stage = getStage();
    if (!stage) return;

    current = loadTransform();
    applyTransform(current);

    stage.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    stage.addEventListener('touchmove',   onTouchMove,   { passive: false });
    stage.addEventListener('touchend',    onTouchEnd,    { passive: false });
    stage.addEventListener('touchcancel', onTouchCancel, { passive: true  });
  }

  function onTouchStart(e) {
    if (!gesture && isInteractiveTarget(e.target)) { gesture = null; return; }
    gesture = snapshot(e.touches);
    if (gesture?.mode === 'pinch') getStage()?.classList.add('dragging');
  }

  function onTouchMove(e) {
    if (!gesture) return;

    if (gesture.mode === 'pan') {
      const t = findTouch(e.touches, gesture.id);
      if (!t) return;
      const dx = t.clientX - gesture.startX;
      const dy = t.clientY - gesture.startY;
      if (!gesture.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        gesture.dragging = true;
        getStage()?.classList.add('dragging');
      }
      e.preventDefault();
      setTransform({
        tx: gesture.baseTx + dx,
        ty: gesture.baseTy + dy,
        scale: gesture.baseScale,
      });
      return;
    }

    // Pinch mode
    const a = findTouch(e.touches, gesture.ida);
    const b = findTouch(e.touches, gesture.idb);
    if (!a || !b) return;
    e.preventDefault();

    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const scale = clampScale(gesture.startScale * (dist / gesture.startDist));

    // Keep the stage-local point that was under the pinch center anchored
    // to the current midpoint as scale and midpoint shift together.
    const ratio = scale / gesture.startScale;
    const tx = midX - gesture.natLeft - ratio * (gesture.startMidX - gesture.natLeft - gesture.baseTx);
    const ty = midY - gesture.natTop  - ratio * (gesture.startMidY - gesture.natTop  - gesture.baseTy);

    setTransform({ tx, ty, scale });
  }

  function onTouchEnd(e) {
    if (!gesture) return;
    const wasDrag = gesture.mode === 'pinch' || gesture.dragging === true;
    if (wasDrag) {
      // Suppress the synthesized mousedown/click so the gesture end doesn't
      // land on the canvas as a tap.
      e.preventDefault();
      saveTransform(current);
    }
    if (e.touches.length > 0) {
      // Re-baseline with the remaining touch(es) so pinch→pan / pan→pinch
      // transitions stay smooth.
      gesture = snapshot(e.touches);
      if (gesture?.mode === 'pinch') getStage()?.classList.add('dragging');
      else getStage()?.classList.remove('dragging');
    } else {
      getStage()?.classList.remove('dragging');
      gesture = null;
    }
  }

  function onTouchCancel() {
    getStage()?.classList.remove('dragging');
    gesture = null;
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
