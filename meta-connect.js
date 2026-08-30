(function () {
  'use strict';

  const META_APP_ID = '1580264870470342';
  const META_CONFIG_ID = '1048835977913160';
  const META_GRAPH_VERSION = 'v26.0';
  const SESSION_INFO_VERSION = '3';
  const TRUSTED_META_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com']);

  const translations = {
    de: {
      dir: 'ltr', titlePage: 'HYBOTE – WhatsApp verbinden', eyebrow: 'Sichere Kontoverbindung',
      title: 'WhatsApp Business mit HYBOTE verbinden',
      intro: 'Autorisieren Sie HYBOTE über den offiziellen Meta-Dialog. Ihr Unternehmen behält die Kontrolle über sein WhatsApp Business-Konto und seine Telefonnummer.',
      trustMeta: 'Offizieller Meta-Dialog', trustOwner: 'Konto bleibt in Ihrem Besitz', trustRevoke: 'Zugriff jederzeit widerrufbar',
      stepsTitle: 'So funktioniert es', step1Title: 'Unternehmen bestätigen', step1Body: 'Melden Sie sich bei Meta an und wählen Sie Ihr Business-Portfolio.',
      step2Title: 'WhatsApp-Konto auswählen', step2Body: 'Wählen oder erstellen Sie das WhatsApp Business-Konto Ihres Unternehmens.',
      step3Title: 'Nummer verbinden', step3Body: 'Bestätigen Sie die Telefonnummer, die HYBOTE für Ihren Service verwenden darf.',
      formTitle: 'Verbindung vorbereiten', formIntro: 'Diese Angaben ordnen das WhatsApp-Konto dem richtigen HYBOTE-Kunden zu.',
      companyLabel: 'Unternehmen', emailLabel: 'Geschäftliche E-Mail-Adresse', referenceLabel: 'HYBOTE-Kundennummer', optional: 'optional',
      authority: 'Ich bin berechtigt, dieses WhatsApp Business-Konto für das oben genannte Unternehmen zu verbinden.',
      privacyPrefix: 'Ich akzeptiere die', privacyLink: 'Datenschutzerklärung', privacySuffix: 'und die Verarbeitung der Verbindungsdaten.',
      connectButton: 'Mit WhatsApp verbinden', connecting: 'Verbindung wird hergestellt …',
      finePrint: 'Sie werden zu einem sicheren Dialog von Meta weitergeleitet. HYBOTE erhält niemals Ihr Facebook-Passwort.',
      successTitle: 'WhatsApp wurde verbunden', successBody: 'Die Kontoverbindung wurde sicher an HYBOTE übergeben. Wir schließen die technische Aktivierung nun ab.',
      backHome: 'Zur HYBOTE-Startseite', support: 'Benötigen Sie Hilfe?', terms: 'AGB', deletion: 'Datenlöschung',
      waba: 'WhatsApp-Konto', phone: 'Telefonnummer', expires: 'Erneuerung bis',
      invalidForm: 'Bitte füllen Sie alle Pflichtfelder aus und bestätigen Sie beide Erklärungen.',
      sdkUnavailable: 'Der Meta-Dialog konnte nicht geladen werden. Bitte deaktivieren Sie Inhaltsblocker für diese Seite und versuchen Sie es erneut.',
      cancelled: 'Die Verbindung wurde abgebrochen. Es wurden keine Änderungen vorgenommen.',
      metaError: 'Meta konnte die Verbindung nicht abschließen. Bitte versuchen Sie es erneut oder kontaktieren Sie HYBOTE.',
      serverError: 'Die Verbindung konnte nicht sicher gespeichert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie HYBOTE.'
    },
    en: {
      dir: 'ltr', titlePage: 'HYBOTE – Connect WhatsApp', eyebrow: 'Secure account connection',
      title: 'Connect WhatsApp Business to HYBOTE',
      intro: 'Authorize HYBOTE through the official Meta dialog. Your business keeps control of its WhatsApp Business Account and phone number.',
      trustMeta: 'Official Meta dialog', trustOwner: 'Your business retains ownership', trustRevoke: 'Access can be revoked anytime',
      stepsTitle: 'How it works', step1Title: 'Confirm your business', step1Body: 'Sign in to Meta and select your Business Portfolio.',
      step2Title: 'Choose your WhatsApp account', step2Body: 'Select or create the WhatsApp Business Account owned by your company.',
      step3Title: 'Connect the number', step3Body: 'Confirm the phone number HYBOTE may use to provide your service.',
      formTitle: 'Prepare the connection', formIntro: 'These details assign the WhatsApp account to the correct HYBOTE customer.',
      companyLabel: 'Company', emailLabel: 'Business email address', referenceLabel: 'HYBOTE customer number', optional: 'optional',
      authority: 'I am authorized to connect this WhatsApp Business Account for the company named above.',
      privacyPrefix: 'I accept the', privacyLink: 'Privacy Policy', privacySuffix: 'and the processing of the connection data.',
      connectButton: 'Connect with WhatsApp', connecting: 'Connecting …',
      finePrint: 'You will continue in a secure Meta dialog. HYBOTE never receives your Facebook password.',
      successTitle: 'WhatsApp is connected', successBody: 'The account connection was securely delivered to HYBOTE. We will now complete the technical activation.',
      backHome: 'Back to HYBOTE', support: 'Need help?', terms: 'Terms', deletion: 'Data deletion',
      waba: 'WhatsApp account', phone: 'Phone number', expires: 'Renew by',
      invalidForm: 'Please complete all required fields and accept both confirmations.',
      sdkUnavailable: 'The Meta dialog could not be loaded. Disable content blockers for this page and try again.',
      cancelled: 'The connection was cancelled. No changes were made.',
      metaError: 'Meta could not complete the connection. Try again or contact HYBOTE.',
      serverError: 'The connection could not be stored securely. Try again or contact HYBOTE.'
    },
    ar: {
      dir: 'rtl', titlePage: 'HYBOTE – ربط واتساب', eyebrow: 'ربط آمن للحساب',
      title: 'اربط WhatsApp Business مع HYBOTE',
      intro: 'فوّض HYBOTE من خلال نافذة Meta الرسمية. تحتفظ شركتك بالتحكم في حساب WhatsApp Business ورقم الهاتف.',
      trustMeta: 'نافذة Meta الرسمية', trustOwner: 'يبقى الحساب ملكاً لشركتك', trustRevoke: 'يمكن إلغاء الوصول في أي وقت',
      stepsTitle: 'طريقة الربط', step1Title: 'تأكيد الشركة', step1Body: 'سجّل الدخول إلى Meta واختر ملف أعمال شركتك.',
      step2Title: 'اختيار حساب واتساب', step2Body: 'اختر أو أنشئ حساب WhatsApp Business المملوك لشركتك.',
      step3Title: 'ربط الرقم', step3Body: 'أكّد رقم الهاتف الذي يمكن لـ HYBOTE استخدامه لتقديم الخدمة.',
      formTitle: 'تجهيز الاتصال', formIntro: 'تربط هذه البيانات حساب واتساب بعميل HYBOTE الصحيح.',
      companyLabel: 'الشركة', emailLabel: 'البريد الإلكتروني للعمل', referenceLabel: 'رقم عميل HYBOTE', optional: 'اختياري',
      authority: 'أنا مخوّل بربط حساب WhatsApp Business هذا نيابةً عن الشركة المذكورة أعلاه.',
      privacyPrefix: 'أوافق على', privacyLink: 'سياسة الخصوصية', privacySuffix: 'ومعالجة بيانات الاتصال.',
      connectButton: 'الربط مع واتساب', connecting: 'جارٍ الربط …',
      finePrint: 'ستنتقل إلى نافذة آمنة من Meta. لا تتلقى HYBOTE كلمة مرور Facebook الخاصة بك أبداً.',
      successTitle: 'تم ربط واتساب', successBody: 'تم تسليم اتصال الحساب إلى HYBOTE بأمان. سنكمل الآن التفعيل التقني.',
      backHome: 'العودة إلى HYBOTE', support: 'تحتاج إلى مساعدة؟', terms: 'الشروط', deletion: 'حذف البيانات',
      waba: 'حساب واتساب', phone: 'رقم الهاتف', expires: 'التجديد قبل',
      invalidForm: 'يرجى تعبئة جميع الحقول المطلوبة والموافقة على الإقرارين.',
      sdkUnavailable: 'تعذر تحميل نافذة Meta. عطّل أدوات حظر المحتوى لهذه الصفحة ثم حاول مجدداً.',
      cancelled: 'تم إلغاء عملية الربط ولم يتم إجراء أي تغيير.',
      metaError: 'تعذر على Meta إكمال الاتصال. حاول مجدداً أو تواصل مع HYBOTE.',
      serverError: 'تعذر حفظ الاتصال بشكل آمن. حاول مجدداً أو تواصل مع HYBOTE.'
    }
  };

  const state = {
    language: 'de',
    csrfToken: '',
    authCode: '',
    sessionInfo: null,
    submitting: false
  };

  const form = document.getElementById('connect-form');
  const button = document.getElementById('connect-button');
  const buttonLabel = button.querySelector('.button-label');
  const errorBox = document.getElementById('form-error');

  function t(key) {
    return translations[state.language][key] || translations.de[key] || key;
  }

  function setLanguage(language) {
    state.language = translations[language] ? language : 'de';
    const copy = translations[state.language];
    document.documentElement.lang = state.language;
    document.documentElement.dir = copy.dir;
    document.body.dir = copy.dir;
    document.title = copy.titlePage;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      if (copy[key]) element.textContent = copy[key];
    });
    document.querySelectorAll('[data-set-lang]').forEach((element) => {
      const active = element.dataset.setLang === state.language;
      element.classList.toggle('active', active);
      element.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.getElementById('privacy-link').href = `/datenschutz.html?lang=${state.language}`;
    document.querySelector('[data-legal="privacy"]').href = `/datenschutz.html?lang=${state.language}`;
    document.querySelector('[data-legal="terms"]').href = `/agb.html?lang=${state.language}`;
    document.querySelector('[data-legal="deletion"]').href = `/data-deletion.html?lang=${state.language}`;
    if (!button.disabled) buttonLabel.textContent = t('connectButton');
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function setLoading(loading) {
    state.submitting = loading;
    button.disabled = loading;
    button.classList.toggle('loading', loading);
    buttonLabel.textContent = loading ? t('connecting') : t('connectButton');
  }

  async function createSecureSession() {
    const response = await fetch('/api/meta/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('SESSION_FAILED');
    const payload = await response.json();
    if (!payload.csrfToken) throw new Error('SESSION_FAILED');
    state.csrfToken = payload.csrfToken;
  }

  function parseMetaMessage(raw) {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_error) { return null; }
    }
    return raw && typeof raw === 'object' ? raw : null;
  }

  window.addEventListener('message', (event) => {
    if (!TRUSTED_META_ORIGINS.has(event.origin)) return;
    const message = parseMetaMessage(event.data);
    if (!message || message.type !== 'WA_EMBEDDED_SIGNUP') return;

    if (message.event === 'FINISH' && message.data) {
      state.sessionInfo = {
        businessId: message.data.business_id || '',
        wabaId: message.data.waba_id || '',
        phoneNumberId: message.data.phone_number_id || ''
      };
      completeConnection();
    } else if (message.event === 'CANCEL') {
      setLoading(false);
      showError(t('cancelled'));
    } else if (message.event === 'ERROR') {
      setLoading(false);
      showError(t('metaError'));
    }
  });

  async function completeConnection() {
    if (state.submitting !== true || !state.authCode || !state.sessionInfo || !state.csrfToken) return;
    if (!state.sessionInfo.wabaId || !state.sessionInfo.phoneNumberId) return;

    try {
      const response = await fetch('/api/meta/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-HYBOTE-CSRF': state.csrfToken
        },
        body: JSON.stringify({
          code: state.authCode,
          businessId: state.sessionInfo.businessId,
          wabaId: state.sessionInfo.wabaId,
          phoneNumberId: state.sessionInfo.phoneNumberId,
          companyName: document.getElementById('company-name').value.trim(),
          workEmail: document.getElementById('work-email').value.trim(),
          customerReference: document.getElementById('customer-reference').value.trim(),
          authorityAccepted: document.getElementById('authority-check').checked,
          privacyAccepted: document.getElementById('privacy-check').checked
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.code || 'COMPLETE_FAILED');
      showSuccess(payload.connection || {});
    } catch (_error) {
      state.authCode = '';
      state.sessionInfo = null;
      setLoading(false);
      showError(t('serverError'));
    }
  }

  function showSuccess(connection) {
    const summary = document.getElementById('connection-summary');
    const rows = [
      [t('waba'), connection.wabaName || connection.wabaId || '—'],
      [t('phone'), connection.displayPhoneNumber || connection.phoneNumberId || '—'],
      [t('expires'), connection.expiresAt ? new Intl.DateTimeFormat(state.language, { dateStyle: 'medium' }).format(new Date(connection.expiresAt)) : '—']
    ];
    summary.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }));
    document.getElementById('form-view').hidden = true;
    document.getElementById('success-view').hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();
    if (!form.checkValidity()) {
      form.reportValidity();
      showError(t('invalidForm'));
      return;
    }
    if (!window.FB || typeof window.FB.login !== 'function') {
      showError(t('sdkUnavailable'));
      return;
    }

    setLoading(true);
    state.authCode = '';
    state.sessionInfo = null;
    try {
      await createSecureSession();
      window.FB.login((response) => {
        if (!response || !response.authResponse || !response.authResponse.code) {
          setLoading(false);
          showError(t('cancelled'));
          return;
        }
        state.authCode = response.authResponse.code;
        completeConnection();
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: SESSION_INFO_VERSION
        }
      });
    } catch (_error) {
      setLoading(false);
      showError(t('serverError'));
    }
  });

  window.fbAsyncInit = function () {
    window.FB.init({
      appId: META_APP_ID,
      autoLogAppEvents: true,
      xfbml: false,
      version: META_GRAPH_VERSION
    });
  };

  document.querySelectorAll('[data-set-lang]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => setLanguage(buttonElement.dataset.setLang));
  });

  const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
  const browserLanguage = (navigator.language || '').slice(0, 2);
  setLanguage(translations[requestedLanguage] ? requestedLanguage : (translations[browserLanguage] ? browserLanguage : 'de'));
})();
