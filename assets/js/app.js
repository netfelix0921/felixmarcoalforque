/* ==========================================================================
   app.js — navigation, mobile menu, scroll reveal, project reveal, dialogs
   No dependencies. Runs deferred, so the DOM is ready.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * 1. sticky nav shadow / condensed state
   * ------------------------------------------------------------------ */
  var nav = document.getElementById('nav');
  var navH = 72;

  function readNavHeight() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
    var n = parseInt(v, 10);
    if (!isNaN(n)) navH = n;
  }
  readNavHeight();

  /* ------------------------------------------------------------------ *
   * 2. active section indicator
   * ------------------------------------------------------------------ */
  var links = [].slice.call(document.querySelectorAll('#navLinks .nav__link'));
  var targets = links
    .map(function (a) {
      var id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return null;
      var el = document.querySelector(id);
      return el ? { link: a, el: el } : null;
    })
    .filter(Boolean);

  var currentLink = null;

  function setActive(link) {
    if (link === currentLink) return;
    if (currentLink) currentLink.removeAttribute('aria-current');
    if (link) link.setAttribute('aria-current', 'true');
    currentLink = link;
  }

  function updateActive() {
    if (!targets.length) return;
    var probe = window.scrollY + navH + 56;
    var found = targets[0];

    for (var i = 0; i < targets.length; i++) {
      if (targets[i].el.offsetTop <= probe) found = targets[i];
    }

    /* at the very bottom of the page, favour the last section */
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      found = targets[targets.length - 1];
    }
    setActive(found.link);
  }

  /* ------------------------------------------------------------------ *
   * 3. one rAF-throttled scroll handler for everything
   * ------------------------------------------------------------------ */
  var queued = false;

  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 12);
      updateActive();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { readNavHeight(); onScroll(); });
  onScroll();

  /* ------------------------------------------------------------------ *
   * 4. mobile menu
   * ------------------------------------------------------------------ */
  var burger = document.getElementById('burger');
  var mobMenu = document.getElementById('mobMenu');
  var menuOpen = false;
  var closeTimer = null;

  function openMenu() {
    if (!mobMenu || menuOpen) return;
    menuOpen = true;
    window.clearTimeout(closeTimer);
    mobMenu.hidden = false;
    /* next frame, so the transition has a starting state to animate from */
    window.requestAnimationFrame(function () { mobMenu.classList.add('open'); });
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    if (!mobMenu || !menuOpen) return;
    menuOpen = false;
    mobMenu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    closeTimer = window.setTimeout(function () {
      if (!menuOpen) mobMenu.hidden = true;
    }, reduceMotion ? 0 : 400);
  }

  if (burger && mobMenu) {
    burger.addEventListener('click', function () { menuOpen ? closeMenu() : openMenu(); });
    mobMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. scroll reveal
   * ------------------------------------------------------------------ */
  var revealSel = '.reveal, .stagger';

  function revealNow(el) { el.classList.add('in'); }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealNow(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }

  function observe(root) {
    var items = [].slice.call((root || document).querySelectorAll(revealSel));
    if (root && root.matches && root.matches(revealSel)) items.unshift(root);
    items.forEach(function (el) {
      if (el.classList.contains('in')) return;
      if (io) io.observe(el); else revealNow(el);
    });
  }
  observe(document);

  /* ------------------------------------------------------------------ *
   * 6. "View all projects"
   * ------------------------------------------------------------------ */
  var moreToggle = document.getElementById('moreToggle');
  var workMore = document.getElementById('workMore');

  if (moreToggle && workMore) {
    var moreLabel = moreToggle.querySelector('span');
    moreToggle.addEventListener('click', function () {
      var expanded = moreToggle.getAttribute('aria-expanded') === 'true';

      if (expanded) {
        workMore.hidden = true;
        moreToggle.setAttribute('aria-expanded', 'false');
        if (moreLabel) moreLabel.textContent = 'View all projects';
      } else {
        workMore.hidden = false;
        moreToggle.setAttribute('aria-expanded', 'true');
        if (moreLabel) moreLabel.textContent = 'Show fewer projects';
        observe(workMore);
        /* they are already on screen, so reveal without waiting for a scroll */
        window.requestAnimationFrame(function () {
          [].slice.call(workMore.querySelectorAll(revealSel)).forEach(revealNow);
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. confirmation dialog
   * ------------------------------------------------------------------ */
  var popup = document.getElementById('popup');
  var popupClose = document.getElementById('popupClose');
  var lastFocused = null;

  function openPopup() {
    if (!popup) return;
    lastFocused = document.activeElement;
    popup.hidden = false;
    window.requestAnimationFrame(function () { popup.classList.add('open'); });
    if (popupClose) popupClose.focus();
  }

  function hidePopup() {
    if (!popup) return;
    popup.classList.remove('open');
    window.setTimeout(function () { popup.hidden = true; }, reduceMotion ? 0 : 340);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  if (popupClose) popupClose.addEventListener('click', hidePopup);
  if (popup) {
    popup.addEventListener('click', function (e) { if (e.target === popup) hidePopup(); });
  }

  /* ------------------------------------------------------------------ *
   * 8. "Hire Felix" focuses the first field after the scroll settles
   * ------------------------------------------------------------------ */
  [].slice.call(document.querySelectorAll('[data-focus]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-focus');
      window.setTimeout(function () {
        var field = document.getElementById(id);
        if (field) field.focus({ preventScroll: true });
      }, reduceMotion ? 60 : 700);
    });
  });

  /* ------------------------------------------------------------------ *
   * 9. Escape closes whatever is open
   * ------------------------------------------------------------------ */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menuOpen) { closeMenu(); if (burger) burger.focus(); }
    if (popup && !popup.hidden) hidePopup();
  });

  /* expose the small bits other modules need */
  window.FelixUI = {
    openPopup: openPopup,
    closePopup: hidePopup,
    observe: observe,
    reduceMotion: reduceMotion
  };
})();
