/* ==========================================================================
   CodeTrace — home.js
   Lightweight interactions for the landing page. No dependencies.

   1. Theme toggle
   2. Mobile navigation
   3. Header shadow + active nav link
   4. Smooth in-page scrolling
   5. Reveal on scroll
   6. Execution preview (static, hand-written trace — NOT a real engine)
   ========================================================================== */

(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------------
     1. Theme toggle
     Light is the default; the saved choice is applied by a tiny inline
     script in <head> so there is no flash.
     ------------------------------------------------------------------------ */
  const THEME_KEY = "codetrace-theme";
  const themeColors = { light: "#f8fafc", dark: "#0b1220" };

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColors[theme]);

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    });
  }

  function initTheme() {
    applyTheme(currentTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (e) {
          /* storage unavailable (private mode): the choice just won't persist */
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     2. Mobile navigation
     ------------------------------------------------------------------------ */
  function initNav() {
    const header = document.querySelector("[data-header]");
    const toggle = document.querySelector("[data-nav-toggle]");
    const menu = document.querySelector("[data-nav-menu]");
    if (!header || !toggle || !menu) return;

    const setOpen = (open) => {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));

    // Close on link click, Escape, outside click, or when the desktop layout returns
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (header.classList.contains("is-open") && !header.contains(e.target)) setOpen(false);
    });

    window.matchMedia("(min-width: 769px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------------
     3. Header shadow on scroll + active navigation link
     ------------------------------------------------------------------------ */
  function initHeaderState() {
    const header = document.querySelector("[data-header]");
    if (header) {
      const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
      update();
      window.addEventListener("scroll", update, { passive: true });
    }

    // Mark the link that points at the current page (the home page has none)
    const here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link").forEach((link) => {
      const target = (link.getAttribute("href") || "").split("/").pop();
      if (target && target === here) link.setAttribute("aria-current", "page");
    });
  }

  /* ------------------------------------------------------------------------
     4. Smooth in-page scrolling (CSS handles the animation; this moves
        keyboard focus to the target so screen-reader and keyboard users
        land where the page scrolled)
     ------------------------------------------------------------------------ */
  function initAnchors() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href").slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      history.pushState(null, "", "#" + id);
    });
  }

  /* ------------------------------------------------------------------------
     5. Reveal on scroll
     ------------------------------------------------------------------------ */
  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (!("IntersectionObserver" in window) || reducedMotion.matches) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    // Stagger siblings slightly so a row of cards doesn't land as one block
    items.forEach((el) => {
      const index = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = `${Math.min(index, 3) * 60}ms`;
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     6. Execution preview
     This is a hand-written trace of a binary search used purely for the
     marketing preview. The real tracer (AST instrumentation, Web Worker,
     trace generation) comes later; its output should match this shape:
       { line, low, high, mid, found, note }  per step.
     ------------------------------------------------------------------------ */
  const PREVIEW_ARRAY = [2, 4, 7, 9, 12];
  const PREVIEW_VARS = ["low", "high", "mid", "target"];

  const PREVIEW_CODE = [
    "const arr = [2, 4, 7, 9, 12];",
    "const target = 9;",
    "let low = 0, high = 4;",
    "while (low <= high) {",
    "  const mid = (low + high) >> 1;",
    "  if (arr[mid] === target) return mid;",
    "  if (arr[mid] < target) low = mid + 1;",
    "  else high = mid - 1;",
    "}",
  ];

  const N = null; // variable not assigned yet
  const PREVIEW_TRACE = [
    { line: 1, low: N, high: N, mid: N, target: N, note: "Create the sorted array." },
    { line: 2, low: N, high: N, mid: N, target: 9, note: "We are searching for 9." },
    { line: 3, low: 0, high: 4, mid: N, target: 9, note: "Start with the whole array: indexes 0 to 4." },
    { line: 4, low: 0, high: 4, mid: N, target: 9, note: "low ≤ high, so keep searching." },
    { line: 5, low: 0, high: 4, mid: 2, target: 9, note: "mid = (0 + 4) >> 1 = 2." },
    { line: 6, low: 0, high: 4, mid: 2, target: 9, note: "arr[2] is 7, not 9. Keep going." },
    { line: 7, low: 0, high: 4, mid: 2, target: 9, note: "7 < 9, so the target is to the right." },
    { line: 7, low: 3, high: 4, mid: 2, target: 9, note: "low moves to mid + 1 = 3." },
    { line: 4, low: 3, high: 4, mid: 2, target: 9, note: "3 ≤ 4, so loop again." },
    { line: 5, low: 3, high: 4, mid: 3, target: 9, note: "mid = (3 + 4) >> 1 = 3." },
    { line: 6, low: 3, high: 4, mid: 3, target: 9, found: 3, note: "arr[3] is 9. It matches the target." },
    { line: 6, low: 3, high: 4, mid: 3, target: 9, found: 3, note: "Return index 3." },
  ];

  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tiny highlighter: just enough for this snippet
  function highlight(src) {
    return escapeHtml(src)
      .replace(/\b(const|let|while|if|else|return)\b/g, '<span class="tk-kw">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tk-num">$1</span>');
  }

  const pad2 = (n) => String(n).padStart(2, "0");

  function initTracePreview(host) {
    const template = document.getElementById("trace-template");
    const mount = host.querySelector("[data-trace-mount]");
    if (!template || !mount) return;

    mount.appendChild(template.content.cloneNode(true));
    const trace = mount.querySelector(".trace");
    if (mount.dataset.variant === "wide") trace.classList.add("trace--wide");

    const el = (role) => host.querySelector(`[data-role="${role}"]`);
    const ui = {
      code: el("code"),
      array: el("array"),
      note: el("note"),
      vars: el("vars"),
      prev: el("prev"),
      next: el("next"),
      play: el("play"),
      playIcon: el("play-icon"),
      playLabel: el("play-label"),
      range: el("range"),
      count: el("count"),
      badgeStep: el("badge-step"),
      badgeTotal: el("badge-total"),
    };

    const total = PREVIEW_TRACE.length;
    const last = total - 1;
    const STEP_MS = 1900;

    let index = 3; // open on step 4 / 12
    let timer = null;
    let wantsAutoplay = host.hasAttribute("data-autoplay") && !reducedMotion.matches;
    let inView = false;
    let hovering = false;
    let userStarted = false; // pressed Play explicitly: ignore hover/visibility pauses

    // Static parts: code lines
    ui.code.innerHTML = PREVIEW_CODE.map((src) => `<li class="code-line">${highlight(src)}</li>`).join("");
    const codeLines = ui.code.children;
    ui.range.max = String(total);
    if (ui.badgeTotal) ui.badgeTotal.textContent = pad2(total);

    function render() {
      const step = PREVIEW_TRACE[index];
      const prevStep = index > 0 ? PREVIEW_TRACE[index - 1] : null;

      // Current line
      Array.prototype.forEach.call(codeLines, (li, i) => {
        const current = i + 1 === step.line;
        li.classList.toggle("is-current", current);
        if (current) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });

      // Variables: rows that changed since the previous step are highlighted
      ui.vars.innerHTML = PREVIEW_VARS.map((name) => {
        const value = step[name];
        const changed = value !== N && (!prevStep || prevStep[name] !== value);
        const shown = value === N ? "—" : value;
        return `<div class="var-row${changed ? " is-changed" : ""}"><dt>${name}</dt><dd${value === N ? ' class="is-empty"' : ""}>${shown}</dd></div>`;
      }).join("");

      // Array with low / mid / high pointers
      const hasRange = step.low !== N;
      ui.array.innerHTML = PREVIEW_ARRAY.map((value, i) => {
        const inRange = !hasRange || (i >= step.low && i <= step.high);
        const isFound = step.found === i;
        const isMid = step.mid === i;
        const classes = ["cell"];
        if (isFound) classes.push("is-found");
        else if (isMid) classes.push("is-current");
        if (!inRange && !isMid) classes.push("is-dim");

        const marks = [];
        if (hasRange && step.low === i) marks.push('<span class="mark">low</span>');
        if (hasRange && step.high === i) marks.push('<span class="mark">high</span>');
        if (isFound) marks.push('<span class="mark mark--found"><i>↑</i> found</span>');
        else if (isMid) marks.push('<span class="mark mark--mid"><i>↑</i> mid</span>');

        return `<div class="cell-wrap"><div class="${classes.join(" ")}">${value}</div><div class="cell-index">${i}</div><div class="cell-marks">${marks.join("")}</div></div>`;
      }).join("");

      ui.note.textContent = step.note;

      // Controls + labels
      const human = index + 1;
      ui.range.value = String(human);
      ui.range.setAttribute("aria-valuetext", `Step ${human} of ${total}`);
      ui.count.textContent = `Step ${human} / ${total}`;
      ui.prev.disabled = index === 0;
      ui.next.disabled = index === last;
      if (ui.badgeStep) ui.badgeStep.textContent = pad2(human);
    }

    function go(next) {
      index = Math.max(0, Math.min(last, next));
      render();
    }

    function isRunning() {
      return timer !== null;
    }

    function setPlayState(playing) {
      ui.play.setAttribute("aria-label", playing ? "Pause" : "Play");
      ui.playLabel.textContent = playing ? "Pause" : "Play";
      ui.playIcon.innerHTML = `<use href="#i-${playing ? "pause" : "play"}"/>`;
    }

    function start() {
      if (isRunning()) return;
      timer = window.setInterval(() => go(index >= last ? 0 : index + 1), STEP_MS);
      setPlayState(true);
    }

    function stop() {
      if (!isRunning()) return;
      window.clearInterval(timer);
      timer = null;
      setPlayState(false);
    }

    // Ambient auto-play only runs while the preview is visible, the tab is
    // active, and nobody is hovering over it. Once the visitor presses Play
    // it keeps running until they pause it.
    function syncAutoplay() {
      const ambient = inView && !hovering;
      const shouldRun = wantsAutoplay && !document.hidden && (userStarted || ambient);
      if (shouldRun) start();
      else stop();
    }

    // Manual input ends auto-play for good (until Play is pressed)
    const userControl = (fn) => () => {
      wantsAutoplay = false;
      userStarted = false;
      stop();
      fn();
    };

    ui.prev.addEventListener("click", userControl(() => go(index - 1)));
    ui.next.addEventListener("click", userControl(() => go(index + 1)));
    ui.range.addEventListener("input", userControl(() => go(Number(ui.range.value) - 1)));

    ui.play.addEventListener("click", () => {
      if (isRunning()) {
        wantsAutoplay = false;
        userStarted = false;
        stop();
      } else {
        wantsAutoplay = true;
        userStarted = true;
        if (index >= last) go(0);
        syncAutoplay();
      }
    });

    host.addEventListener("pointerenter", () => {
      hovering = true;
      syncAutoplay();
    });
    host.addEventListener("pointerleave", () => {
      hovering = false;
      syncAutoplay();
    });
    document.addEventListener("visibilitychange", syncAutoplay);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          syncAutoplay();
        },
        { threshold: 0.35 }
      ).observe(host);
    }

    setPlayState(false);
    render();
  }

  function initPreviews() {
    document.querySelectorAll("[data-trace-preview]").forEach(initTracePreview);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function init() {
    initTheme();
    initNav();
    initHeaderState();
    initAnchors();
    initPreviews(); // before reveal so cloned content exists
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
