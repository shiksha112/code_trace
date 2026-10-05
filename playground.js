/* ==========================================================================
   CodeTrace — playground.js

   Architecture (UI side):

     USER CODE → [executionEngine.run()] → TRACE[] → loadTrace() → PLAYER → renderStep()
                                                                   ├─ highlightCodeLine()
                                                                   ├─ renderVisualization()
                                                                   └─ renderVariables / CallStack / Console

   Everything below the "MOCK TRACE" section is driven purely by the trace
   structure, so a real engine only needs to (1) implement executionEngine.run()
   and (2) return trace entries in the same shape as mockTrace.

   NOT implemented on purpose: parsing, instrumentation, workers, sandboxing,
   auto-detection of trees/graphs, other languages.
   ========================================================================== */

(function () {
  'use strict';

  /* ======================================================================
     CONSTANTS
     ====================================================================== */

  var THEME_KEY = 'codetrace-theme';
  var PLAY_INTERVAL_MS = 900;
  var STATUS_FLASH_MS = 3500;

  var SAMPLE_CODE = [
    'const arr = [2, 4, 7, 9, 12];',
    'const target = 7;',
    '',
    'let low = 0;',
    'let high = arr.length - 1;',
    '',
    'while (low <= high) {',
    '    const mid = Math.floor((low + high) / 2);',
    '',
    '    if (arr[mid] === target) {',
    '        console.log("Found");',
    '        break;',
    '    }',
    '',
    '    if (arr[mid] < target) {',
    '        low = mid + 1;',
    '    } else {',
    '        high = mid - 1;',
    '    }',
    '}'
  ].join('\n');

  var INPUT_TYPES = {
    array:  { example: '[2, 4, 7, 9, 12]' },
    number: { example: '7' },
    string: { example: '"codetrace"' },
    tree:   { example: '[8, 4, 12, 2, 6]' },
    graph:  { example: '[[0,1], [0,2], [1,3], [2,4]]' },
    custom: { example: '{ "nums": [1, 2, 3] }' }
  };

  var STATUS_LABELS = {
    ready: 'Ready',
    running: 'Running...',
    complete: 'Execution Complete',
    error: 'Execution Error',
    soon: 'Coming Soon'
  };

  /* ======================================================================
     MOCK TRACE  (replace with real engine output later)
     Shape of one entry:
       { step, line, label, variables, visualization, callStack, output }
     - step:          1-based step number (step 0 = "before execution", no entry)
     - line:          1-based line in the editor to highlight
     - variables:     { name: value }  (values may be numbers, strings, arrays…)
     - visualization: { type: 'array'|'tree'|'graph', currentIndex, pointers, found? }
     - callStack:     frames, bottom → top
     - output:        cumulative console output at this step
     ====================================================================== */

  var mockTrace = [
    {
      step: 1, line: 4, label: 'Initialize low = 0 and high = 4',
      variables: { arr: [2, 4, 7, 9, 12], target: 7, low: 0, high: 4 },
      visualization: { type: 'array', currentIndex: null, pointers: { low: 0, high: 4 } },
      callStack: ['Global'], output: ''
    },
    {
      step: 2, line: 8, label: 'Compute mid = floor((0 + 4) / 2) = 2',
      variables: { arr: [2, 4, 7, 9, 12], target: 7, low: 0, high: 4, mid: 2 },
      visualization: { type: 'array', currentIndex: 2, pointers: { low: 0, mid: 2, high: 4 } },
      callStack: ['Global'], output: ''
    },
    {
      step: 3, line: 10, label: 'Check arr[mid] === target  →  7 === 7 is true',
      variables: { arr: [2, 4, 7, 9, 12], target: 7, low: 0, high: 4, mid: 2 },
      visualization: { type: 'array', currentIndex: 2, pointers: { low: 0, mid: 2, high: 4 } },
      callStack: ['Global'], output: ''
    },
    {
      step: 4, line: 11, label: 'Log "Found" to the console',
      variables: { arr: [2, 4, 7, 9, 12], target: 7, low: 0, high: 4, mid: 2 },
      visualization: { type: 'array', currentIndex: 2, pointers: { low: 0, mid: 2, high: 4 }, found: true },
      callStack: ['Global'], output: 'Found'
    },
    {
      step: 5, line: 12, label: 'break exits the loop — execution complete',
      variables: { arr: [2, 4, 7, 9, 12], target: 7, low: 0, high: 4, mid: 2 },
      visualization: { type: 'array', currentIndex: 2, pointers: { low: 0, mid: 2, high: 4 }, found: true },
      callStack: ['Global'], output: 'Found'
    }
  ];

  /* Sample state shown before any step (clearly labelled "Preview") */
  var PREVIEW_ENTRY = mockTrace[1];

  /* Fixed sample data used when a non-array viz mode is chosen manually */
  var SAMPLE_STRUCTURES = {
    tree: { type: 'tree', values: [8, 4, 12, 2, 6], currentIndex: null },
    graph: {
      type: 'graph', currentIndex: null,
      nodes: [
        { id: 0, x: 160, y: 30 }, { id: 1, x: 90, y: 100 }, { id: 2, x: 230, y: 100 },
        { id: 3, x: 90, y: 170 }, { id: 4, x: 230, y: 170 }
      ],
      edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]]
    }
  };

  /* ======================================================================
     EXECUTION ENGINE HOOK  (future)
     Implement run() to return a trace array (same shape as mockTrace)
     and flip isAvailable() to true.
     ====================================================================== */

  var executionEngine = {
    isAvailable: function () { return false; },
    run: function (/* request */) {
      return Promise.reject(new Error('Execution engine is not connected yet.'));
    }
  };

  /* ======================================================================
     STATE
     ====================================================================== */

  var playgroundState = {
    currentStep: 0,
    isPlaying: false,
    selectedLanguage: 'javascript',
    inputType: 'array',
    dataStructure: 'auto',
    visualizationType: 'auto',
    steps: [],
    traceSource: 'mock',
    activeLine: null
  };

  var els = {};
  var playTimer = null;
  var statusTimer = null;
  var escapeTab = false;

  /* ======================================================================
     SMALL HELPERS
     ====================================================================== */

  function $(id) { return document.getElementById(id); }

  function h(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function formatValue(v) {
    if (Array.isArray(v)) return '[' + v.map(formatValue).join(', ') + ']';
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function getEntry() {
    return playgroundState.currentStep > 0
      ? playgroundState.steps[playgroundState.currentStep - 1] || null
      : null;
  }

  /* ======================================================================
     SYNTAX HIGHLIGHTING (lightweight, replaceable by Monaco/CodeMirror)
     ====================================================================== */

  var TOKEN_RE = new RegExp([
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',                                   // 1 comment
    '("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`)', // 2 string
    '(\\b\\d+(?:\\.\\d+)?\\b)',                                                // 3 number
    '\\b(const|let|var|function|return|if|else|while|for|break|continue|new|class|of|in|switch|case|default|do|try|catch|finally|throw|async|await|true|false|null|undefined|typeof)\\b', // 4 keyword
    '\\b(Math|console|Array|Object|String|Number|JSON|Map|Set)\\b',           // 5 builtin
    '(\\b[A-Za-z_$][\\w$]*)(?=\\()'                                            // 6 function call
  ].join('|'), 'g');

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightSyntax(code) {
    return escapeHtml(code).replace(TOKEN_RE, function (m, comment, str, num, kw, builtin, fn) {
      var cls = comment ? 'comment' : str ? 'string' : num ? 'number' : kw ? 'keyword' : builtin ? 'builtin' : 'fn';
      return '<span class="tok-' + cls + '">' + m + '</span>';
    });
  }

  /* ======================================================================
     INITIALIZATION
     ====================================================================== */

  function initializePlayground() {
    [
      'navToggle', 'siteNav', 'themeToggle', 'languageSelect', 'statusIndicator', 'statusText',
      'resetBtn', 'runBtn', 'editorLang', 'codeMenuBtn', 'codeMenu', 'editor', 'editorScroll',
      'editorGutter', 'caretLineBar', 'execLineBar', 'editorHighlight', 'codeInput',
      'vizSelect', 'vizEmpty', 'vizOff', 'vizStage', 'vizBadge', 'vizCanvas', 'vizChips', 'vizCaption',
      'stateNote', 'varBody', 'stackList', 'consoleOutput',
      'inputType', 'dataStructure', 'inputValue', 'inputExample', 'useExampleBtn',
      'prevBtn', 'playBtn', 'playIcon', 'playLabel', 'nextBtn', 'stepCounter', 'traceSource',
      'timeline', 'timelineTicks'
    ].forEach(function (id) { els[id] = $(id); });

    initializeChrome();
    initializeEditor();
    initializeControls();
    initializeInputPanel();
    initializeVisualization();
    initializeExecutionState();

    loadTrace(mockTrace, { source: 'mock' });
  }

  /* Navbar: theme toggle + mobile menu (same behaviour as Home Page) */
  function initializeChrome() {
    function syncThemeButton() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      els.themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    syncThemeButton();
    els.themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
      syncThemeButton();
    });

    function setNav(open) {
      els.siteNav.classList.toggle('is-open', open);
      els.navToggle.setAttribute('aria-expanded', String(open));
    }
    els.navToggle.addEventListener('click', function () {
      setNav(els.navToggle.getAttribute('aria-expanded') !== 'true');
    });
    els.siteNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.navToggle.getAttribute('aria-expanded') === 'true') {
        setNav(false);
        els.navToggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) setNav(false);
    });
  }

  /* ---------------------------- Editor ---------------------------- */

  function initializeEditor() {
    var ta = els.codeInput;
    ta.value = SAMPLE_CODE;
    renderEditor();

    ta.addEventListener('input', onCodeChange);
    ['keyup', 'click', 'focus', 'select'].forEach(function (evt) {
      ta.addEventListener(evt, updateCaretLine);
    });

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { escapeTab = true; return; }
      if (e.key === 'Tab' && !e.shiftKey && !escapeTab) {
        e.preventDefault();
        insertAtCaret('    ');
        return;
      }
      if (e.key !== 'Shift' && e.key !== 'Tab') escapeTab = false;
    });
    ta.addEventListener('blur', function () { escapeTab = false; });

    // Code menu (⋮)
    var btn = els.codeMenuBtn;
    var menu = els.codeMenu;
    function items() { return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')); }
    function closeMenu(returnFocus) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (returnFocus) btn.focus();
    }
    function openMenu() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      items()[0].focus();
    }
    btn.addEventListener('click', function () { menu.hidden ? openMenu() : closeMenu(false); });
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('[data-action]');
      if (!item) return;
      closeMenu(true);
      handleCodeAction(item.getAttribute('data-action'));
    });
    menu.addEventListener('keydown', function (e) {
      var list = items();
      var i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') { closeMenu(false); }
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !e.target.closest('.menu-wrap')) closeMenu(false);
    });
  }

  function insertAtCaret(text) {
    var ta = els.codeInput;
    ta.focus();
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      onCodeChange();
    }
  }

  function handleCodeAction(action) {
    if (action === 'clear') {
      setCode('');
      resetPlayground();
      flashStatus('ready', 'Editor cleared');
    } else if (action === 'example') {
      setCode(SAMPLE_CODE);
      resetPlayground();
      flashStatus('ready', 'Example restored');
    } else if (action === 'copy') {
      copyCode();
    }
  }

  function setCode(code) {
    els.codeInput.value = code;
    onCodeChange();
    els.editorScroll.scrollTop = 0;
    els.editorScroll.scrollLeft = 0;
  }

  function copyCode() {
    var text = els.codeInput.value;
    function fallback() {
      try {
        els.codeInput.select();
        var ok = document.execCommand('copy');
        flashStatus(ok ? 'ready' : 'error', ok ? 'Code copied' : 'Copy failed');
      } catch (e) {
        flashStatus('error', 'Copy failed');
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashStatus('ready', 'Code copied'); },
        fallback
      );
    } else {
      fallback();
    }
  }

  function onCodeChange() {
    renderEditor();
    updateCaretLine();
    updateTraceBadge();
  }

  function renderEditor() {
    var code = els.codeInput.value;
    els.editorHighlight.innerHTML = highlightSyntax(code) + (code.slice(-1) === '\n' ? ' ' : '');

    var count = code.split('\n').length;
    if (els.editorGutter.childElementCount !== count) {
      var frag = document.createDocumentFragment();
      for (var i = 1; i <= count; i++) frag.appendChild(h('div', 'gutter-line', String(i)));
      els.editorGutter.replaceChildren(frag);
      applyActiveLine(playgroundState.activeLine);
    }
  }

  function updateCaretLine() {
    var ta = els.codeInput;
    var line = ta.value.slice(0, ta.selectionStart).split('\n').length;
    els.caretLineBar.style.setProperty('--line', String(line));
  }

  /* Active (execution) line */
  function highlightCodeLine(line) {
    playgroundState.activeLine = line;
    applyActiveLine(line);
  }

  function applyActiveLine(line) {
    var gutterLines = els.editorGutter.children;
    for (var i = 0; i < gutterLines.length; i++) {
      gutterLines[i].classList.toggle('is-active', line !== null && i === line - 1);
    }
    if (line === null || line === undefined) {
      els.execLineBar.hidden = true;
      return;
    }
    els.execLineBar.hidden = false;
    els.execLineBar.style.setProperty('--line', String(line));
    scrollLineIntoView(line);
  }

  function scrollLineIntoView(line) {
    var cs = getComputedStyle(els.editor);
    var lh = parseFloat(cs.getPropertyValue('--editor-line-height')) || 22;
    var pad = parseFloat(cs.getPropertyValue('--editor-pad-y')) || 12;
    var sc = els.editorScroll;
    var top = pad + (line - 1) * lh;
    var bottom = top + lh;
    if (top < sc.scrollTop + lh) sc.scrollTop = Math.max(0, top - lh * 2);
    else if (bottom > sc.scrollTop + sc.clientHeight - lh) sc.scrollTop = bottom - sc.clientHeight + lh * 2;
  }

  /* ---------------------------- Controls ---------------------------- */

  function initializeControls() {
    els.runBtn.addEventListener('click', runCode);
    els.resetBtn.addEventListener('click', resetPlayground);
    els.prevBtn.addEventListener('click', previousStep);
    els.nextBtn.addEventListener('click', nextStep);
    els.playBtn.addEventListener('click', togglePlayback);

    els.timeline.addEventListener('input', function () {
      stopPlayback();
      setStep(Number(els.timeline.value));
    });

    els.languageSelect.addEventListener('change', function () {
      var opt = els.languageSelect.selectedOptions[0];
      if (opt.disabled) { els.languageSelect.value = 'javascript'; return; }
      playgroundState.selectedLanguage = els.languageSelect.value;
      els.editorLang.textContent = opt.textContent;
    });
  }

  /* ---------------------------- Input panel ---------------------------- */

  function initializeInputPanel() {
    applyInputType(false);

    els.inputType.addEventListener('change', function () {
      var prevExample = INPUT_TYPES[playgroundState.inputType].example;
      playgroundState.inputType = els.inputType.value;
      var current = els.inputValue.value.trim();
      applyInputType(current === '' || current === prevExample);
    });

    els.dataStructure.addEventListener('change', function () {
      playgroundState.dataStructure = els.dataStructure.value; // UI-only for now
    });

    els.useExampleBtn.addEventListener('click', function () {
      els.inputValue.value = INPUT_TYPES[playgroundState.inputType].example;
      els.inputValue.focus();
    });
  }

  function applyInputType(replaceValue) {
    var ex = INPUT_TYPES[playgroundState.inputType].example;
    els.inputValue.placeholder = ex;
    els.inputExample.textContent = 'Example: ' + ex;
    if (replaceValue) els.inputValue.value = ex;
  }

  /* ---------------------------- Visualization ---------------------------- */

  function initializeVisualization() {
    els.vizSelect.addEventListener('change', function () {
      playgroundState.visualizationType = els.vizSelect.value;
      renderVisualization(getEntry());
    });
  }

  /* Renderers are registered by type — a future engine only supplies data. */
  var visualizationRenderers = {
    array: renderArray,
    tree: renderTree,
    graph: renderGraph
  };

  function renderArray(canvas, data) {
    var values = data.values || [];
    var pointers = data.pointers || {};
    var wrap = h('div', 'array-cells');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Array ' + formatValue(values) +
      (data.currentIndex !== null && data.currentIndex !== undefined ? ', current index ' + data.currentIndex : ''));

    values.forEach(function (value, i) {
      var cell = h('div', 'array-cell');
      var isCurrent = i === data.currentIndex;
      if (isCurrent) cell.classList.add('is-current');
      if (isCurrent && data.found) cell.classList.add('is-found');

      cell.appendChild(h('div', 'cell-value', formatValue(value)));
      cell.appendChild(h('div', 'cell-index', String(i)));

      var markers = h('div', 'cell-markers');
      if (isCurrent) markers.appendChild(h('span', 'marker marker-current', '▲ current'));
      Object.keys(pointers).forEach(function (name) {
        if (pointers[name] === i) markers.appendChild(h('span', 'marker', name));
      });
      cell.appendChild(markers);
      wrap.appendChild(cell);
    });
    canvas.replaceChildren(wrap);
  }

  function renderTree(canvas, data) {
    var values = data.values || [];
    var W = 320, R = 18, levelH = 64;
    var levels = Math.max(1, Math.floor(Math.log2(Math.max(1, values.length))) + 1);
    var H = (levels - 1) * levelH + R * 2 + 16;

    function pos(i) {
      var level = Math.floor(Math.log2(i + 1));
      var idx = i - (Math.pow(2, level) - 1);
      return { x: ((idx + 0.5) / Math.pow(2, level)) * W, y: R + 8 + level * levelH };
    }

    var svg = svgEl('svg', { 'class': 'viz-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Binary tree with values ' + values.join(', ') });
    values.forEach(function (_, i) {
      [2 * i + 1, 2 * i + 2].forEach(function (c) {
        if (c < values.length) {
          var a = pos(i), b = pos(c);
          svg.appendChild(svgEl('line', { 'class': 'svg-edge', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
        }
      });
    });
    values.forEach(function (v, i) {
      var p = pos(i);
      var g = svgEl('g', {});
      g.appendChild(svgEl('circle', { 'class': 'svg-node' + (i === data.currentIndex ? ' is-current' : ''), cx: p.x, cy: p.y, r: R }));
      var t = svgEl('text', { 'class': 'svg-label', x: p.x, y: p.y });
      t.textContent = String(v);
      g.appendChild(t);
      svg.appendChild(g);
    });
    canvas.replaceChildren(svg);
  }

  function renderGraph(canvas, data) {
    var nodes = data.nodes || [];
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var svg = svgEl('svg', { 'class': 'viz-svg', viewBox: '0 0 320 200', role: 'img',
      'aria-label': 'Graph with ' + nodes.length + ' nodes and ' + (data.edges || []).length + ' edges' });
    (data.edges || []).forEach(function (e) {
      var a = byId[e[0]], b = byId[e[1]];
      if (a && b) svg.appendChild(svgEl('line', { 'class': 'svg-edge', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    });
    nodes.forEach(function (n) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('circle', { 'class': 'svg-node' + (n.id === data.currentIndex ? ' is-current' : ''), cx: n.x, cy: n.y, r: 18 }));
      var t = svgEl('text', { 'class': 'svg-label', x: n.x, y: n.y });
      t.textContent = String(n.id);
      g.appendChild(t);
      svg.appendChild(g);
    });
    canvas.replaceChildren(svg);
  }

  function toVizData(entry) {
    var viz = entry.visualization;
    var data = Object.assign({}, viz);
    if (data.values === undefined && entry.variables && Array.isArray(entry.variables.arr)) {
      data.values = entry.variables.arr;
    }
    return data;
  }

  function renderVisualization(entry) {
    var mode = playgroundState.visualizationType;
    var isPreview = !entry;
    var source = entry || PREVIEW_ENTRY;

    // Caption (always)
    els.vizCaption.replaceChildren();
    if (isPreview) {
      els.vizCaption.textContent = 'Sample state shown as a preview. Press Next to step through a mock trace.';
    } else {
      els.vizCaption.appendChild(h('strong', '', 'Step ' + entry.step + ' — '));
      els.vizCaption.appendChild(document.createTextNode(entry.label || ''));
    }

    els.vizOff.hidden = mode !== 'none';
    els.vizStage.hidden = mode === 'none';
    els.vizEmpty.hidden = !(isPreview && mode !== 'none');
    if (mode === 'none') {
      els.vizCanvas.replaceChildren();
      els.vizChips.replaceChildren();
      return;
    }

    var traceType = source.visualization.type;
    var type = mode === 'auto' ? traceType : mode;
    var fromTrace = type === traceType;
    var data = fromTrace ? toVizData(source) : SAMPLE_STRUCTURES[type];

    visualizationRenderers[type](els.vizCanvas, data);

    els.vizStage.dataset.type = type;
    els.vizStage.classList.toggle('is-preview', isPreview || !fromTrace);
    els.vizBadge.textContent = isPreview ? 'Preview' : fromTrace ? 'Mock trace' : 'Sample structure';

    if (!fromTrace && !isPreview) {
      els.vizCaption.appendChild(document.createTextNode(' · Sample structure, not derived from your code'));
    }

    // Pointer / scalar chips (array view driven by trace)
    els.vizChips.replaceChildren();
    if (fromTrace && type === 'array') {
      var pointers = source.visualization.pointers || {};
      var vars = source.variables || {};
      var keys = Object.keys(pointers).concat(Object.keys(vars).filter(function (k) {
        return !(k in pointers) && !Array.isArray(vars[k]);
      }));
      keys.forEach(function (k) {
        var chip = h('div', 'chip' + (k in pointers ? ' is-pointer' : ''));
        chip.appendChild(h('dt', '', k));
        chip.appendChild(h('dd', '', formatValue(k in vars ? vars[k] : pointers[k])));
        els.vizChips.appendChild(chip);
      });
    }
  }

  /* ---------------------------- Execution state ---------------------------- */

  function initializeExecutionState() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  function renderVariables(entry, prevEntry) {
    var vars = (entry || PREVIEW_ENTRY).variables || {};
    var prev = prevEntry ? prevEntry.variables : null;
    var names = Object.keys(vars);
    els.varBody.classList.toggle('is-preview', !entry);

    if (!names.length) {
      var tr = h('tr');
      var td = h('td', 'var-empty', 'No variables in scope.');
      td.colSpan = 2;
      tr.appendChild(td);
      els.varBody.replaceChildren(tr);
      return;
    }
    var rows = names.map(function (name) {
      var tr = h('tr');
      var value = formatValue(vars[name]);
      if (entry && prev && (!(name in prev) || formatValue(prev[name]) !== value)) tr.classList.add('is-changed');
      tr.appendChild(h('td', 'var-name', name));
      var vtd = h('td', 'var-value', value);
      vtd.title = value;
      tr.appendChild(vtd);
      return tr;
    });
    els.varBody.replaceChildren.apply(els.varBody, rows);
  }

  function renderCallStack(entry) {
    var frames = ((entry || PREVIEW_ENTRY).callStack || ['Global']).slice().reverse(); // top first
    var items = frames.map(function (name, i) {
      var li = h('li', 'stack-frame' + (i === 0 ? ' is-top' : ''));
      li.appendChild(h('span', '', name));
      if (i === 0) li.appendChild(h('span', 'badge', 'current'));
      return li;
    });
    els.stackList.replaceChildren.apply(els.stackList, items);
  }

  function renderConsole(entry) {
    var out = entry && entry.output ? entry.output : '';
    if (!out) {
      els.consoleOutput.replaceChildren(h('p', 'console-empty', 'Console output will appear here.'));
      return;
    }
    var lines = out.split('\n').map(function (text) {
      var row = h('div', 'console-line');
      var prompt = h('span', 'console-prompt', '›');
      prompt.setAttribute('aria-hidden', 'true');
      row.appendChild(prompt);
      row.appendChild(h('span', '', text));
      return row;
    });
    els.consoleOutput.replaceChildren.apply(els.consoleOutput, lines);
  }

  /* ======================================================================
     PLAYER
     ====================================================================== */

  function loadTrace(trace, opts) {
    stopPlayback();
    playgroundState.steps = Array.isArray(trace) ? trace : [];
    playgroundState.traceSource = (opts && opts.source) || 'engine';
    playgroundState.currentStep = 0;
    rebuildTicks();
    updateTraceBadge();
    renderStep();
  }

  function setStep(n) {
    var total = playgroundState.steps.length;
    playgroundState.currentStep = Math.max(0, Math.min(total, n));
    renderStep();
  }

  function nextStep() { stopPlayback(); setStep(playgroundState.currentStep + 1); }
  function previousStep() { stopPlayback(); setStep(playgroundState.currentStep - 1); }

  function startPlayback() {
    var total = playgroundState.steps.length;
    if (!total) return;
    if (playgroundState.currentStep >= total) playgroundState.currentStep = 0;
    playgroundState.isPlaying = true;
    advance();
    if (playgroundState.isPlaying) playTimer = setInterval(advance, PLAY_INTERVAL_MS);
    renderStep();
  }

  function advance() {
    var total = playgroundState.steps.length;
    if (playgroundState.currentStep < total) playgroundState.currentStep += 1;
    if (playgroundState.currentStep >= total) {
      playgroundState.isPlaying = false;
      clearInterval(playTimer);
      playTimer = null;
    }
    renderStep();
  }

  function stopPlayback() {
    var was = playgroundState.isPlaying;
    playgroundState.isPlaying = false;
    clearInterval(playTimer);
    playTimer = null;
    if (was) renderStep();
  }

  function togglePlayback() {
    if (playgroundState.isPlaying) stopPlayback();
    else startPlayback();
  }

  /* ---------------------------- Rendering ---------------------------- */

  function renderStep() {
    var entry = getEntry();
    var prevEntry = playgroundState.currentStep > 1 ? playgroundState.steps[playgroundState.currentStep - 2] : null;

    renderVariables(entry, prevEntry);
    renderCallStack(entry);
    renderConsole(entry);
    renderVisualization(entry);
    highlightCodeLine(entry ? entry.line : null);
    els.stateNote.hidden = !!entry;
    updateTimeline();
    updateControls();
    syncStatus();
  }

  function updateTimeline() {
    var total = playgroundState.steps.length;
    var cur = playgroundState.currentStep;
    els.timeline.max = String(total);
    els.timeline.value = String(cur);
    els.timeline.disabled = total === 0;
    els.timeline.style.setProperty('--progress', (total ? (cur / total) * 100 : 0) + '%');
    els.timeline.setAttribute('aria-valuetext', 'Step ' + cur + ' of ' + total);
    els.stepCounter.textContent = 'Step ' + cur + ' / ' + total;

    var ticks = els.timelineTicks.children;
    for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle('is-reached', i <= cur);
  }

  function rebuildTicks() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i <= playgroundState.steps.length; i++) frag.appendChild(document.createElement('span'));
    els.timelineTicks.replaceChildren(frag);
  }

  function updateControls() {
    var total = playgroundState.steps.length;
    var cur = playgroundState.currentStep;
    els.prevBtn.disabled = cur <= 0;
    els.nextBtn.disabled = cur >= total;
    els.playBtn.disabled = total === 0;
    els.playBtn.setAttribute('aria-pressed', String(playgroundState.isPlaying));
    els.playIcon.textContent = playgroundState.isPlaying ? 'Ⅱ' : '▶';
    els.playLabel.textContent = playgroundState.isPlaying ? 'Pause' : 'Play';
    els.playBtn.title = playgroundState.isPlaying ? 'Pause playback' : 'Play through the execution steps';
  }

  function updateTraceBadge() {
    var badge = els.traceSource;
    if (playgroundState.traceSource === 'mock') {
      var sample = els.codeInput.value === SAMPLE_CODE;
      badge.textContent = sample ? 'Mock trace' : 'Mock trace · sample code only';
      badge.classList.toggle('is-warning', !sample);
      badge.title = sample ? 'Steps come from a built-in mock trace'
                           : 'The mock trace belongs to the sample code, not your edits';
    } else {
      badge.textContent = 'Execution trace';
      badge.classList.remove('is-warning');
      badge.removeAttribute('title');
    }
  }

  /* ---------------------------- Status ---------------------------- */

  function updateStatus(state, message) {
    els.statusIndicator.dataset.state = state;
    els.statusText.textContent = message || STATUS_LABELS[state];
  }

  function syncStatus() {
    var total = playgroundState.steps.length;
    var cur = playgroundState.currentStep;
    if (playgroundState.isPlaying) updateStatus('running');
    else if (total > 0 && cur >= total) updateStatus('complete');
    else updateStatus('ready');
  }

  function flashStatus(state, message) {
    clearTimeout(statusTimer);
    updateStatus(state, message);
    statusTimer = setTimeout(syncStatus, STATUS_FLASH_MS);
  }

  /* ======================================================================
     ACTIONS
     ====================================================================== */

  /* Future flow:
       send user code to execution engine → receive trace → loadTrace(trace) */
  function runCode() {
    stopPlayback();
    var request = {
      language: playgroundState.selectedLanguage,
      code: els.codeInput.value,
      input: els.inputValue.value,
      inputType: playgroundState.inputType,
      dataStructure: playgroundState.dataStructure
    };

    if (!executionEngine.isAvailable()) {
      flashStatus('soon', 'Execution engine coming soon');
      return;
    }

    clearTimeout(statusTimer);
    updateStatus('running');
    executionEngine.run(request).then(
      function (trace) { loadTrace(trace, { source: 'engine' }); },
      function (err) { flashStatus('error', (err && err.message) || 'Execution Error'); }
    );
  }

  function resetPlayground() {
    stopPlayback();
    clearTimeout(statusTimer);
    setStep(0);
  }

  /* ======================================================================
     BOOT + PUBLIC SURFACE FOR THE FUTURE ENGINE
     ====================================================================== */

  window.CodeTracePlayground = {
    state: playgroundState,
    executionEngine: executionEngine,   // swap/extend with the real engine
    visualizationRenderers: visualizationRenderers,
    loadTrace: loadTrace,
    runCode: runCode,
    resetPlayground: resetPlayground,
    nextStep: nextStep,
    previousStep: previousStep,
    togglePlayback: togglePlayback
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlayground);
  } else {
    initializePlayground();
  }
})();
