/**
 * CodeTrace — examples.js
 * Controls interactions on the Examples library page:
 * - Theme toggling and mobile menu (shared design system)
 * - Centralized data rendering from CodeTraceExamples
 * - Live search (title, description, category)
 * - Category filtering (All, Arrays, Searching, Sorting, Trees, Graphs)
 * - Empty state handling and reset
 */

(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'codetrace-theme';
  var themeColors = { light: '#f8fafc', dark: '#0b1220' };

  /* ======================================================================
     1. THEME TOGGLE
     ====================================================================== */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColors[theme]);

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  function initTheme() {
    applyTheme(currentTheme());
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (e) {
          /* storage unavailable */
        }
      });
    });
  }

  /* ======================================================================
     2. MOBILE NAVIGATION
     ====================================================================== */
  function initNav() {
    var header = document.querySelector('[data-header]');
    var toggle = document.querySelector('[data-nav-toggle]');
    var menu = document.querySelector('[data-nav-menu]');
    if (!header || !toggle || !menu) return;

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-open'));
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (header.classList.contains('is-open') && !header.contains(e.target)) {
        setOpen(false);
      }
    });

    window.matchMedia('(min-width: 769px)').addEventListener('change', function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* ======================================================================
     3. EXAMPLES CONTROLLER
     ====================================================================== */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initExamples() {
    var examples = window.CodeTraceExamples || [];
    var gridEl = document.getElementById('examplesGrid');
    var emptyEl = document.getElementById('emptyState');
    var searchInput = document.getElementById('exampleSearch');
    var searchClearBtn = document.getElementById('searchClear');
    var categoryChips = document.querySelectorAll('.category-chip');
    var resetFiltersBtn = document.getElementById('resetFiltersBtn');

    if (!gridEl || !emptyEl) return;

    var state = {
      category: 'All',
      search: ''
    };

    function filterExamples() {
      var q = state.search.trim().toLowerCase();
      var cat = state.category;

      return examples.filter(function (item) {
        // Category filter
        var matchesCategory = cat === 'All' || item.category === cat;
        if (!matchesCategory) return false;

        // Search filter
        if (!q) return true;
        var titleMatch = item.title && item.title.toLowerCase().indexOf(q) !== -1;
        var descMatch = item.description && item.description.toLowerCase().indexOf(q) !== -1;
        var catMatch = item.category && item.category.toLowerCase().indexOf(q) !== -1;

        return titleMatch || descMatch || catMatch;
      });
    }

    function renderCard(item) {
      return [
        '<article class="example-card" data-id="' + escapeHtml(item.id) + '">',
        '  <div class="card-content">',
        '    <h2 class="card-title">' + escapeHtml(item.title) + '</h2>',
        '    <p class="card-desc">' + escapeHtml(item.description) + '</p>',
        '    <div class="card-meta">',
        '      <span class="meta-item">' + escapeHtml(item.category) + ' · ' + escapeHtml(item.difficulty) + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="card-footer">',
        '    <a href="playground.html?example=' + encodeURIComponent(item.id) + '" class="card-action">',
        '      <span>Try Example</span>',
        '      <svg class="action-arrow" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '        <path d="M5 12h14M13 6l6 6-6 6"/>',
        '      </svg>',
        '    </a>',
        '  </div>',
        '</article>'
      ].join('\n');
    }

    function update() {
      var filtered = filterExamples();

      if (filtered.length === 0) {
        gridEl.hidden = true;
        gridEl.innerHTML = '';
        emptyEl.hidden = false;
      } else {
        emptyEl.hidden = true;
        gridEl.hidden = false;
        gridEl.innerHTML = filtered.map(renderCard).join('');
      }

      // Update clear button visibility
      if (searchClearBtn) {
        searchClearBtn.hidden = !state.search;
      }
    }

    // Search events
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.search = searchInput.value;
        update();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', function () {
        state.search = '';
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        update();
      });
    }

    // Category click events
    categoryChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.getAttribute('data-category');
        state.category = cat;

        categoryChips.forEach(function (c) {
          var isActive = c === chip;
          c.classList.toggle('is-active', isActive);
          c.setAttribute('aria-selected', String(isActive));
        });

        update();
      });
    });

    // Reset filters action
    function resetAll() {
      state.category = 'All';
      state.search = '';

      if (searchInput) searchInput.value = '';

      categoryChips.forEach(function (c) {
        var isAll = c.getAttribute('data-category') === 'All';
        c.classList.toggle('is-active', isAll);
        c.setAttribute('aria-selected', String(isAll));
      });

      update();
      if (searchInput) searchInput.focus();
    }

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', resetAll);
    }

    // Initial render
    update();
  }

  /* ======================================================================
     4. BOOT
     ====================================================================== */
  function init() {
    initTheme();
    initNav();
    initExamples();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
