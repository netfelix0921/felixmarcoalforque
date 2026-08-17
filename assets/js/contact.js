/* ==========================================================================
   contact.js — EmailJS pipeline (preserved from the original build)
   service_idfylpd / template_mwj260i / public key clYt3hnTwhHOCCeVq
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  var submit = document.getElementById('formSubmit');
  var status = document.getElementById('formStatus');
  if (!form || !submit) return;

  var label = submit.querySelector('.form__submit-label');
  var EMAILJS_PUBLIC_KEY = 'clYt3hnTwhHOCCeVq';
  var EMAILJS_SERVICE = 'service_idfylpd';
  var EMAILJS_TEMPLATE = 'template_mwj260i';

  var ready = false;
  try {
    if (window.emailjs && typeof window.emailjs.init === 'function') {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
      ready = true;
    }
  } catch (err) {
    ready = false;
  }

  function say(msg, tone) {
    if (!status) return;
    status.textContent = msg || '';
    if (tone) status.setAttribute('data-tone', tone);
    else status.removeAttribute('data-tone');
  }

  function setLabel(text) { if (label) label.textContent = text; }

  function reset(delay) {
    window.setTimeout(function () {
      submit.disabled = false;
      submit.removeAttribute('data-state');
      setLabel('Send message');
    }, delay || 2600);
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstName = (document.getElementById('firstName').value || '').trim();
    var lastName = (document.getElementById('lastName').value || '').trim();
    var email = (document.getElementById('emailAddr').value || '').trim();
    var projectType = (document.getElementById('projectType').value || '').trim();
    var subject = (document.getElementById('subject').value || '').trim();
    var message = (document.getElementById('message').value || '').trim();

    /* ---- validation, with focus moved to the offending field ---- */
    if (!firstName) {
      say('Please add your first name.', 'error');
      document.getElementById('firstName').focus();
      return;
    }
    if (!EMAIL_RE.test(email)) {
      say('Please enter a valid email address.', 'error');
      document.getElementById('emailAddr').focus();
      return;
    }
    if (!projectType) {
      say('Please select a project type.', 'error');
      document.getElementById('projectType').focus();
      return;
    }
    if (message.length < 10) {
      say('Please add a little more detail (at least 10 characters).', 'error');
      document.getElementById('message').focus();
      return;
    }

    if (!ready) {
      submit.setAttribute('data-state', 'error');
      setLabel('Email service unavailable');
      say('The mail service did not load. Please email contact@felixmarcoalforque.it.com directly.', 'error');
      reset(4200);
      return;
    }

    submit.disabled = true;
    setLabel('Sending…');
    say('');

    var now = new Date().toLocaleString('en-PH', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'
    });

    var templateParams = {
      from_name: firstName + (lastName ? ' ' + lastName : ''),
      email: email,
      subject: subject || 'Portfolio Inquiry',
      project_type: projectType,
      /* prefixed onto the message body too, so it shows up in the email even
         if the EmailJS template itself isn't updated to render {{project_type}} */
      message: 'Project type: ' + projectType + '\n\n' + message,
      time: now
    };

    window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, templateParams)
      .then(function () {
        submit.setAttribute('data-state', 'sent');
        setLabel('Message sent');
        say('Thanks — I received your brief.', 'ok');
        form.reset();
        if (window.FelixUI && window.FelixUI.openPopup) window.FelixUI.openPopup();
        reset(3000);
      })
      .catch(function () {
        submit.setAttribute('data-state', 'error');
        setLabel('Could not send');
        say('Something went wrong on the way out. Please email contact@felixmarcoalforque.it.com directly.', 'error');
        reset(4200);
      });
  });

  /* clear an error the moment the visitor starts fixing it — 'change' is
     included alongside 'input' because some browsers only fire 'input' on
     <select> for keyboard interaction, not a mouse pick from the list */
  function clearErrorOnFix() {
    if (status && status.getAttribute('data-tone') === 'error') say('');
  }
  form.addEventListener('input', clearErrorOnFix);
  form.addEventListener('change', clearErrorOnFix);
})();
