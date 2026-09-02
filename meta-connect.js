(function () {
  'use strict';

  const META_APP_ID = '1580264870470342';
  const META_CONFIG_ID = '2471938683272654';
  const META_GRAPH_VERSION = 'v26.0';
  // Embedded Signup v4: Version und Session-Info-Format kommen aus der
  // Facebook-Login-for-Business-Konfiguration (config_id), nicht mehr aus
  // Parametern. Bleibt nur der Feature-Typ fuer Coexistence – Metas Doku nennt
  // ihn uneinheitlich, deshalb genau eine Stelle zum Aendern.
  const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding';
  const TRUSTED_META_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com']);
  // Metas Dialog folgt der Sprache des geladenen SDK, nicht der Seite. Ein fest
  // eingebundenes de_DE-SDK zeigt einem arabischen Kunden einen deutschen Dialog.
  const SDK_LOCALES = { en: 'en_US', ar: 'ar_AR', de: 'de_DE', ru: 'ru_RU', fr: 'fr_FR' };

  const translations = {
    en: {
      dir: 'ltr', titlePage: 'HYBOTE – Connect WhatsApp', eyebrow: 'Secure account connection',
      title: 'Connect WhatsApp Business to HYBOTE',
      intro: 'Authorize HYBOTE through the official Meta dialog. Your business keeps control of its WhatsApp Business Account and phone number.',
      trustMeta: 'Official Meta dialog', trustOwner: 'Your business retains ownership', trustRevoke: 'Access can be revoked anytime',
      stepsTitle: 'How it works', step1Title: 'Confirm your business', step1Body: 'Sign in to Meta and select your Business Portfolio.',
      step2Title: 'Keep your existing number', step2Body: 'Scan the QR code shown by Meta. Your number, the WhatsApp Business app and your chat history all stay with you.',
      step3Title: 'Confirm the connection', step3Body: 'Confirm the phone number HYBOTE may use to provide your service.',
      prereqTitle: 'Before you start',
      prereq1: 'WhatsApp Business app version 2.24.17 or newer',
      prereq2: 'The number has been in use in that app for at least 7 days',
      prereq3: 'A phone with a camera, to scan the QR code',
      gateTitle: 'Please use your personal invitation link',
      gateBody: 'This page can only be opened through the personal link HYBOTE sent you. If your link has expired, we will gladly send you a new one.',
      gateAction: 'Request a new link',
      formTitle: 'Prepare the connection', formIntro: 'These details assign the WhatsApp account to the correct HYBOTE customer.',
      companyLabel: 'Company', emailLabel: 'Business email address', referenceLabel: 'HYBOTE customer number',
      authority: 'I am authorized to connect this WhatsApp Business Account for the company named above.',
      privacyPrefix: 'I accept the', privacyLink: 'Privacy Policy', privacySuffix: 'and the processing of the connection data.',
      connectButton: 'Connect with WhatsApp', connecting: 'Connecting …',
      finePrint: 'You will continue in a secure Meta dialog. HYBOTE never receives your Facebook password.',
      successTitle: 'WhatsApp is connected', successBody: 'The account connection was securely delivered to HYBOTE. We will now complete the technical activation.',
      nextStepTitle: 'One step left: add a payment method',
      nextStepBody: 'WhatsApp charges its messaging fees directly to your own business account. Add a payment method to your WhatsApp Business Account in the Meta Business Suite — without it, message delivery stops once the free allowance is used up.',
      nextStepAction: 'Open billing settings at Meta',
      backHome: 'Back to HYBOTE', support: 'Need help?', terms: 'Terms', deletion: 'Data deletion',
      waba: 'WhatsApp account', phone: 'Phone number', expires: 'Renew by', mode: 'Mode',
      modeCoexistence: 'Coexistence — app and API on the same number', modeDedicated: 'Dedicated API number',
      invalidForm: 'Please accept both confirmations.',
      sdkUnavailable: 'The Meta dialog could not be loaded. Disable content blockers for this page and try again.',
      cancelled: 'The connection was cancelled. No changes were made.',
      metaError: 'Meta could not complete the connection. Try again or contact HYBOTE.',
      serverError: 'The connection could not be stored securely. Try again or contact HYBOTE.',
      pinConflict: 'This number already has its own two-step verification PIN. Please contact HYBOTE — we will complete the activation with you.',
      registrationLimited: 'Meta is temporarily blocking new registrations for this number. Please try again in 72 hours or contact HYBOTE.',
      numberNotVerified: 'This phone number is not verified with Meta yet. Complete the verification and then try again.',
      wabaNotAuthorized: 'The authorization did not cover the selected WhatsApp account. Please start again and select the correct business.',
      tooManyAttempts: 'Too many attempts. Please wait a few minutes.',
      inviteInvalid: 'Your invitation link is no longer valid. Please contact HYBOTE for a new one.'
    },
    ar: {
      dir: 'rtl', titlePage: 'HYBOTE – ربط واتساب', eyebrow: 'ربط آمن للحساب',
      title: 'اربط WhatsApp Business مع HYBOTE',
      intro: 'فوّض HYBOTE من خلال نافذة Meta الرسمية. تحتفظ شركتك بالتحكم في حساب WhatsApp Business ورقم الهاتف.',
      trustMeta: 'نافذة Meta الرسمية', trustOwner: 'يبقى الحساب ملكاً لشركتك', trustRevoke: 'يمكن إلغاء الوصول في أي وقت',
      stepsTitle: 'طريقة الربط', step1Title: 'تأكيد الشركة', step1Body: 'سجّل الدخول إلى Meta واختر ملف أعمال شركتك.',
      step2Title: 'احتفظ برقمك الحالي', step2Body: 'امسح رمز QR الذي تعرضه Meta. يبقى رقمك وتطبيق WhatsApp Business وسجل محادثاتك كما هو.',
      step3Title: 'تأكيد الربط', step3Body: 'أكّد رقم الهاتف الذي يمكن لـ HYBOTE استخدامه لتقديم الخدمة.',
      prereqTitle: 'قبل أن تبدأ',
      prereq1: 'تطبيق WhatsApp Business بإصدار 2.24.17 أو أحدث',
      prereq2: 'الرقم مستخدم في التطبيق منذ 7 أيام على الأقل',
      prereq3: 'هاتف مزوّد بكاميرا لمسح رمز QR',
      gateTitle: 'يرجى استخدام رابط الدعوة الخاص بك',
      gateBody: 'لا يمكن فتح هذه الصفحة إلا عبر الرابط الشخصي الذي أرسلته لك HYBOTE. إذا انتهت صلاحية الرابط، سنرسل لك رابطاً جديداً بكل سرور.',
      gateAction: 'اطلب رابطاً جديداً',
      formTitle: 'تجهيز الاتصال', formIntro: 'تربط هذه البيانات حساب واتساب بعميل HYBOTE الصحيح.',
      companyLabel: 'الشركة', emailLabel: 'البريد الإلكتروني للعمل', referenceLabel: 'رقم عميل HYBOTE',
      authority: 'أنا مخوّل بربط حساب WhatsApp Business هذا نيابةً عن الشركة المذكورة أعلاه.',
      privacyPrefix: 'أوافق على', privacyLink: 'سياسة الخصوصية', privacySuffix: 'ومعالجة بيانات الاتصال.',
      connectButton: 'الربط مع واتساب', connecting: 'جارٍ الربط …',
      finePrint: 'ستنتقل إلى نافذة آمنة من Meta. لا تتلقى HYBOTE كلمة مرور Facebook الخاصة بك أبداً.',
      successTitle: 'تم ربط واتساب', successBody: 'تم تسليم اتصال الحساب إلى HYBOTE بأمان. سنكمل الآن التفعيل التقني.',
      nextStepTitle: 'خطوة أخيرة: أضف وسيلة دفع',
      nextStepBody: 'تحتسب Meta رسوم الرسائل مباشرةً على حساب أعمالك. أضف وسيلة دفع إلى حساب WhatsApp Business الخاص بك في Meta Business Suite — بدونها يتوقف إرسال الرسائل بعد استنفاد الحصة المجانية.',
      nextStepAction: 'افتح إعدادات الفوترة في Meta',
      backHome: 'العودة إلى HYBOTE', support: 'تحتاج إلى مساعدة؟', terms: 'الشروط', deletion: 'حذف البيانات',
      waba: 'حساب واتساب', phone: 'رقم الهاتف', expires: 'التجديد قبل', mode: 'وضع التشغيل',
      modeCoexistence: 'تعايُش — التطبيق وواجهة البرمجة على الرقم نفسه', modeDedicated: 'رقم مخصص لواجهة البرمجة',
      invalidForm: 'يرجى الموافقة على الإقرارين.',
      sdkUnavailable: 'تعذر تحميل نافذة Meta. عطّل أدوات حظر المحتوى لهذه الصفحة ثم حاول مجدداً.',
      cancelled: 'تم إلغاء عملية الربط ولم يتم إجراء أي تغيير.',
      metaError: 'تعذر على Meta إكمال الاتصال. حاول مجدداً أو تواصل مع HYBOTE.',
      serverError: 'تعذر حفظ الاتصال بشكل آمن. حاول مجدداً أو تواصل مع HYBOTE.',
      pinConflict: 'هذا الرقم لديه بالفعل رمز تحقق بخطوتين خاص به. يرجى التواصل مع HYBOTE لإكمال التفعيل معاً.',
      registrationLimited: 'تحظر Meta مؤقتاً تسجيل هذا الرقم. حاول بعد 72 ساعة أو تواصل مع HYBOTE.',
      numberNotVerified: 'لم يتم التحقق من رقم الهاتف لدى Meta بعد. أكمل التحقق ثم حاول مجدداً.',
      wabaNotAuthorized: 'لم يشمل التفويض حساب واتساب المحدد. ابدأ من جديد واختر الشركة الصحيحة.',
      tooManyAttempts: 'محاولات كثيرة جداً. يرجى الانتظار بضع دقائق.',
      inviteInvalid: 'لم يعد رابط الدعوة صالحاً. تواصل مع HYBOTE للحصول على رابط جديد.'
    },
    de: {
      dir: 'ltr', titlePage: 'HYBOTE – WhatsApp verbinden', eyebrow: 'Sichere Kontoverbindung',
      title: 'WhatsApp Business mit HYBOTE verbinden',
      intro: 'Autorisieren Sie HYBOTE über den offiziellen Meta-Dialog. Ihr Unternehmen behält die Kontrolle über sein WhatsApp Business-Konto und seine Telefonnummer.',
      trustMeta: 'Offizieller Meta-Dialog', trustOwner: 'Konto bleibt in Ihrem Besitz', trustRevoke: 'Zugriff jederzeit widerrufbar',
      stepsTitle: 'So funktioniert es', step1Title: 'Unternehmen bestätigen', step1Body: 'Melden Sie sich bei Meta an und wählen Sie Ihr Business-Portfolio.',
      step2Title: 'Bestehende Nummer behalten', step2Body: 'Scannen Sie den QR-Code von Meta. Ihre Nummer, die WhatsApp Business App und Ihr Chatverlauf bleiben erhalten.',
      step3Title: 'Verbindung bestätigen', step3Body: 'Bestätigen Sie die Telefonnummer, die HYBOTE für Ihren Service verwenden darf.',
      prereqTitle: 'Bevor Sie starten',
      prereq1: 'WhatsApp Business App ab Version 2.24.17',
      prereq2: 'Die Nummer wird seit mindestens 7 Tagen in dieser App genutzt',
      prereq3: 'Ein Handy mit Kamera für den QR-Code',
      gateTitle: 'Bitte nutzen Sie Ihren persönlichen Einladungslink',
      gateBody: 'Diese Seite lässt sich nur über den persönlichen Link öffnen, den HYBOTE Ihnen geschickt hat. Ist Ihr Link abgelaufen, senden wir Ihnen gerne einen neuen.',
      gateAction: 'Neuen Link anfordern',
      formTitle: 'Verbindung vorbereiten', formIntro: 'Diese Angaben ordnen das WhatsApp-Konto dem richtigen HYBOTE-Kunden zu.',
      companyLabel: 'Unternehmen', emailLabel: 'Geschäftliche E-Mail-Adresse', referenceLabel: 'HYBOTE-Kundennummer',
      authority: 'Ich bin berechtigt, dieses WhatsApp Business-Konto für das oben genannte Unternehmen zu verbinden.',
      privacyPrefix: 'Ich akzeptiere die', privacyLink: 'Datenschutzerklärung', privacySuffix: 'und die Verarbeitung der Verbindungsdaten.',
      connectButton: 'Mit WhatsApp verbinden', connecting: 'Verbindung wird hergestellt …',
      finePrint: 'Sie werden zu einem sicheren Dialog von Meta weitergeleitet. HYBOTE erhält niemals Ihr Facebook-Passwort.',
      successTitle: 'WhatsApp wurde verbunden', successBody: 'Die Kontoverbindung wurde sicher an HYBOTE übergeben. Wir schließen die technische Aktivierung nun ab.',
      nextStepTitle: 'Ein Schritt fehlt noch: Zahlungsmethode hinterlegen',
      nextStepBody: 'Meta rechnet die WhatsApp-Gebühren direkt über Ihr eigenes Unternehmenskonto ab. Hinterlegen Sie eine Zahlungsmethode für Ihr WhatsApp Business-Konto in der Meta Business Suite — ohne sie stoppt der Versand, sobald das Freikontingent aufgebraucht ist.',
      nextStepAction: 'Zahlungseinstellungen bei Meta öffnen',
      backHome: 'Zur HYBOTE-Startseite', support: 'Benötigen Sie Hilfe?', terms: 'AGB', deletion: 'Datenlöschung',
      waba: 'WhatsApp-Konto', phone: 'Telefonnummer', expires: 'Erneuerung bis', mode: 'Betriebsart',
      modeCoexistence: 'Coexistence — App und API auf derselben Nummer', modeDedicated: 'Eigene API-Nummer',
      invalidForm: 'Bitte bestätigen Sie beide Erklärungen.',
      sdkUnavailable: 'Der Meta-Dialog konnte nicht geladen werden. Bitte deaktivieren Sie Inhaltsblocker für diese Seite und versuchen Sie es erneut.',
      cancelled: 'Die Verbindung wurde abgebrochen. Es wurden keine Änderungen vorgenommen.',
      metaError: 'Meta konnte die Verbindung nicht abschließen. Bitte versuchen Sie es erneut oder kontaktieren Sie HYBOTE.',
      serverError: 'Die Verbindung konnte nicht sicher gespeichert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie HYBOTE.',
      pinConflict: 'Für diese Nummer ist bereits eine eigene Bestätigungs-PIN gesetzt. Bitte kontaktieren Sie HYBOTE — wir schließen die Aktivierung gemeinsam mit Ihnen ab.',
      registrationLimited: 'Meta sperrt die Registrierung dieser Nummer vorübergehend. Bitte in 72 Stunden erneut versuchen oder HYBOTE kontaktieren.',
      numberNotVerified: 'Diese Telefonnummer ist bei Meta noch nicht verifiziert. Bitte schließen Sie die Verifizierung ab und versuchen Sie es erneut.',
      wabaNotAuthorized: 'Die Autorisierung umfasste das gewählte WhatsApp-Konto nicht. Bitte starten Sie erneut und wählen Sie das richtige Unternehmen.',
      tooManyAttempts: 'Zu viele Versuche. Bitte warten Sie einige Minuten.',
      inviteInvalid: 'Ihr Einladungslink ist nicht mehr gültig. Bitte fordern Sie bei HYBOTE einen neuen an.'
    },
    ru: {
      dir: 'ltr', titlePage: 'HYBOTE – Подключить WhatsApp', eyebrow: 'Безопасное подключение аккаунта',
      title: 'Подключите WhatsApp Business к HYBOTE',
      intro: 'Авторизуйте HYBOTE через официальный диалог Meta. Ваша компания сохраняет контроль над своим аккаунтом WhatsApp Business и номером телефона.',
      trustMeta: 'Официальный диалог Meta', trustOwner: 'Аккаунт остаётся вашим', trustRevoke: 'Доступ можно отозвать в любой момент',
      stepsTitle: 'Как это работает', step1Title: 'Подтвердите компанию', step1Body: 'Войдите в Meta и выберите свой бизнес-портфель.',
      step2Title: 'Сохраните свой номер', step2Body: 'Отсканируйте QR-код, который покажет Meta. Ваш номер, приложение WhatsApp Business и история чатов остаются у вас.',
      step3Title: 'Подтвердите подключение', step3Body: 'Подтвердите номер телефона, который HYBOTE может использовать для вашего сервиса.',
      prereqTitle: 'Перед началом',
      prereq1: 'Приложение WhatsApp Business версии 2.24.17 или новее',
      prereq2: 'Номер используется в этом приложении не менее 7 дней',
      prereq3: 'Телефон с камерой для сканирования QR-кода',
      gateTitle: 'Пожалуйста, используйте персональную ссылку-приглашение',
      gateBody: 'Эту страницу можно открыть только по персональной ссылке, которую вам отправила HYBOTE. Если срок ссылки истёк, мы с радостью отправим новую.',
      gateAction: 'Запросить новую ссылку',
      formTitle: 'Подготовка подключения', formIntro: 'Эти данные связывают аккаунт WhatsApp с правильным клиентом HYBOTE.',
      companyLabel: 'Компания', emailLabel: 'Рабочий адрес электронной почты', referenceLabel: 'Номер клиента HYBOTE',
      authority: 'Я уполномочен(а) подключить этот аккаунт WhatsApp Business от имени указанной выше компании.',
      privacyPrefix: 'Я принимаю', privacyLink: 'Политику конфиденциальности', privacySuffix: 'и обработку данных подключения.',
      connectButton: 'Подключить WhatsApp', connecting: 'Подключение …',
      finePrint: 'Вы продолжите в защищённом диалоге Meta. HYBOTE никогда не получает ваш пароль Facebook.',
      successTitle: 'WhatsApp подключён', successBody: 'Подключение аккаунта безопасно передано в HYBOTE. Теперь мы завершим техническую активацию.',
      nextStepTitle: 'Остался один шаг: добавьте способ оплаты',
      nextStepBody: 'WhatsApp списывает плату за сообщения напрямую с вашего бизнес-аккаунта. Добавьте способ оплаты для аккаунта WhatsApp Business в Meta Business Suite — без него отправка сообщений остановится после исчерпания бесплатного лимита.',
      nextStepAction: 'Открыть настройки оплаты в Meta',
      backHome: 'Вернуться на HYBOTE', support: 'Нужна помощь?', terms: 'Условия', deletion: 'Удаление данных',
      waba: 'Аккаунт WhatsApp', phone: 'Номер телефона', expires: 'Продлить до', mode: 'Режим',
      modeCoexistence: 'Coexistence — приложение и API на одном номере', modeDedicated: 'Отдельный номер для API',
      invalidForm: 'Пожалуйста, подтвердите оба пункта.',
      sdkUnavailable: 'Не удалось загрузить диалог Meta. Отключите блокировщики контента для этой страницы и попробуйте снова.',
      cancelled: 'Подключение отменено. Изменения не внесены.',
      metaError: 'Meta не смогла завершить подключение. Попробуйте снова или свяжитесь с HYBOTE.',
      serverError: 'Не удалось безопасно сохранить подключение. Попробуйте снова или свяжитесь с HYBOTE.',
      pinConflict: 'Для этого номера уже задан собственный PIN двухэтапной проверки. Свяжитесь с HYBOTE — мы завершим активацию вместе с вами.',
      registrationLimited: 'Meta временно блокирует регистрацию этого номера. Попробуйте через 72 часа или свяжитесь с HYBOTE.',
      numberNotVerified: 'Этот номер телефона ещё не подтверждён в Meta. Завершите подтверждение и попробуйте снова.',
      wabaNotAuthorized: 'Авторизация не охватила выбранный аккаунт WhatsApp. Начните заново и выберите правильную компанию.',
      tooManyAttempts: 'Слишком много попыток. Подождите несколько минут.',
      inviteInvalid: 'Ваша ссылка-приглашение больше не действительна. Запросите новую у HYBOTE.'
    },
    fr: {
      dir: 'ltr', titlePage: 'HYBOTE – Connecter WhatsApp', eyebrow: 'Connexion sécurisée du compte',
      title: 'Connectez WhatsApp Business à HYBOTE',
      intro: "Autorisez HYBOTE via la boîte de dialogue officielle de Meta. Votre entreprise garde le contrôle de son compte WhatsApp Business et de son numéro de téléphone.",
      trustMeta: 'Dialogue Meta officiel', trustOwner: 'Le compte reste votre propriété', trustRevoke: "L'accès peut être révoqué à tout moment",
      stepsTitle: 'Comment ça marche', step1Title: 'Confirmez votre entreprise', step1Body: 'Connectez-vous à Meta et sélectionnez votre portefeuille professionnel.',
      step2Title: 'Conservez votre numéro actuel', step2Body: "Scannez le code QR affiché par Meta. Votre numéro, l'application WhatsApp Business et votre historique de conversations restent chez vous.",
      step3Title: 'Confirmez la connexion', step3Body: 'Confirmez le numéro de téléphone que HYBOTE peut utiliser pour votre service.',
      prereqTitle: 'Avant de commencer',
      prereq1: 'Application WhatsApp Business version 2.24.17 ou plus récente',
      prereq2: 'Le numéro est utilisé dans cette application depuis au moins 7 jours',
      prereq3: 'Un téléphone avec caméra pour scanner le code QR',
      gateTitle: "Veuillez utiliser votre lien d'invitation personnel",
      gateBody: "Cette page ne peut être ouverte que via le lien personnel que HYBOTE vous a envoyé. Si votre lien a expiré, nous vous en enverrons volontiers un nouveau.",
      gateAction: 'Demander un nouveau lien',
      formTitle: 'Préparer la connexion', formIntro: 'Ces informations associent le compte WhatsApp au bon client HYBOTE.',
      companyLabel: 'Entreprise', emailLabel: 'Adresse e-mail professionnelle', referenceLabel: 'Numéro de client HYBOTE',
      authority: "Je suis habilité(e) à connecter ce compte WhatsApp Business pour l'entreprise indiquée ci-dessus.",
      privacyPrefix: "J'accepte la", privacyLink: 'Politique de confidentialité', privacySuffix: 'et le traitement des données de connexion.',
      connectButton: 'Connecter avec WhatsApp', connecting: 'Connexion en cours …',
      finePrint: 'Vous continuerez dans une boîte de dialogue sécurisée de Meta. HYBOTE ne reçoit jamais votre mot de passe Facebook.',
      successTitle: 'WhatsApp est connecté', successBody: "La connexion du compte a été transmise en toute sécurité à HYBOTE. Nous finalisons maintenant l'activation technique.",
      nextStepTitle: 'Dernière étape : ajoutez un moyen de paiement',
      nextStepBody: "WhatsApp facture ses frais de messagerie directement sur votre propre compte professionnel. Ajoutez un moyen de paiement à votre compte WhatsApp Business dans Meta Business Suite — sans cela, l'envoi de messages s'arrête une fois le quota gratuit épuisé.",
      nextStepAction: 'Ouvrir les paramètres de facturation chez Meta',
      backHome: 'Retour à HYBOTE', support: "Besoin d'aide ?", terms: 'Conditions', deletion: 'Suppression des données',
      waba: 'Compte WhatsApp', phone: 'Numéro de téléphone', expires: 'Renouveler avant le', mode: 'Mode',
      modeCoexistence: "Coexistence — application et API sur le même numéro", modeDedicated: 'Numéro API dédié',
      invalidForm: 'Veuillez accepter les deux confirmations.',
      sdkUnavailable: 'La boîte de dialogue Meta n\'a pas pu être chargée. Désactivez les bloqueurs de contenu pour cette page et réessayez.',
      cancelled: "La connexion a été annulée. Aucune modification n'a été effectuée.",
      metaError: "Meta n'a pas pu finaliser la connexion. Réessayez ou contactez HYBOTE.",
      serverError: "La connexion n'a pas pu être enregistrée en toute sécurité. Réessayez ou contactez HYBOTE.",
      pinConflict: "Ce numéro possède déjà son propre code PIN de vérification en deux étapes. Veuillez contacter HYBOTE — nous finaliserons l'activation avec vous.",
      registrationLimited: "Meta bloque temporairement l'enregistrement de ce numéro. Réessayez dans 72 heures ou contactez HYBOTE.",
      numberNotVerified: "Ce numéro de téléphone n'est pas encore vérifié chez Meta. Terminez la vérification puis réessayez.",
      wabaNotAuthorized: "L'autorisation ne couvrait pas le compte WhatsApp sélectionné. Recommencez et sélectionnez la bonne entreprise.",
      tooManyAttempts: 'Trop de tentatives. Veuillez patienter quelques minutes.',
      inviteInvalid: "Votre lien d'invitation n'est plus valide. Veuillez demander un nouveau lien à HYBOTE."
    }
  };

  const ERROR_KEYS = {
    PIN_CONFLICT: 'pinConflict',
    REGISTRATION_RATE_LIMITED: 'registrationLimited',
    NUMBER_NOT_VERIFIED: 'numberNotVerified',
    WABA_NOT_AUTHORIZED: 'wabaNotAuthorized',
    TOKEN_NOT_VALID: 'wabaNotAuthorized',
    TOO_MANY_ATTEMPTS: 'tooManyAttempts',
    PHONE_NUMBER_UNRESOLVED: 'wabaNotAuthorized',
    INVITE_INVALID: 'inviteInvalid'
  };

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite') || '';

  const state = {
    language: 'en',
    invite: null,
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
    return translations[state.language][key] || translations.en[key] || key;
  }

  function applyLanguage(language) {
    state.language = translations[language] ? language : 'en';
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

  /** Das Meta-SDK laesst sich nur einmal und nur mit einer Sprache laden. Deshalb
   *  wird es erst geladen, wenn die Sprache feststeht – und ein Sprachwechsel
   *  laedt die Seite neu, statt einen Dialog in der falschen Sprache zu oeffnen. */
  function loadMetaSdk(language) {
    const script = document.createElement('script');
    script.src = `https://connect.facebook.net/${SDK_LOCALES[language] || SDK_LOCALES.en}/sdk.js`;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }

  async function loadInvite() {
    if (!inviteToken) return null;
    try {
      const response = await fetch(`/api/meta/invite?token=${encodeURIComponent(inviteToken)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.ok ? payload.invite : null;
    } catch (_error) {
      return null;
    }
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

    // v4 meldet FINISH; der Coexistence-Dialog meldet
    // FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING und liefert dabei nur die WABA –
    // die Nummer ermittelt der Server aus der WABA.
    if ((message.event === 'FINISH' || message.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') && message.data) {
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
    if (!state.sessionInfo.wabaId) return;

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
          inviteToken,
          code: state.authCode,
          businessId: state.sessionInfo.businessId,
          wabaId: state.sessionInfo.wabaId,
          phoneNumberId: state.sessionInfo.phoneNumberId,
          authorityAccepted: document.getElementById('authority-check').checked,
          privacyAccepted: document.getElementById('privacy-check').checked
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.code || 'COMPLETE_FAILED');
      showSuccess(payload.connection || {});
    } catch (error) {
      state.authCode = '';
      state.sessionInfo = null;
      setLoading(false);
      showError(t(ERROR_KEYS[error.message] || 'serverError'));
    }
  }

  function showSuccess(connection) {
    const summary = document.getElementById('connection-summary');
    // Telefonnummern und Konto-IDs sind immer LTR. Ohne die explizite Isolierung
    // dreht der Browser "+971 4 555 0110" im arabischen Layout zu "0110 555 4 971+"
    // und zeigt dem Kunden seine eigene Nummer falsch an.
    const rows = [
      [t('waba'), connection.wabaName || connection.wabaId || '—', 'ltr'],
      [t('phone'), connection.displayPhoneNumber || connection.phoneNumberId || '—', 'ltr'],
      [t('mode'), connection.coexistence ? t('modeCoexistence') : t('modeDedicated'), 'auto'],
      [t('expires'), connection.expiresAt ? new Intl.DateTimeFormat(state.language, { dateStyle: 'medium' }).format(new Date(connection.expiresAt)) : '—', 'auto']
    ];
    summary.replaceChildren(...rows.map(([label, value, direction]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      if (direction === 'ltr') dd.dir = 'ltr';
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
          // Vorbefuellung aus dem signierten Einladungs-Token – mehr Branding
          // erlaubt Metas Dialog nicht.
          setup: {
            business: {
              name: (state.invite && state.invite.company) || '',
              email: (state.invite && state.invite.email) || ''
            }
          },
          featureType: COEXISTENCE_FEATURE_TYPE
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
    buttonElement.addEventListener('click', () => {
      const next = new URLSearchParams(window.location.search);
      next.set('lang', buttonElement.dataset.setLang);
      window.location.search = next.toString();
    });
  });

  const requestedLanguage = params.get('lang');
  const browserLanguage = (navigator.language || '').slice(0, 2);

  /** Reihenfolge: ?lang (Sprachpille) → Sprache aus dem Einladungs-Token (im
   *  Sales Pilot gewaehlt) → Browsersprache → Englisch. Deshalb wird die
   *  Einladung VOR der Sprache aufgeloest und das SDK erst danach geladen. */
  function resolveLanguage(invite) {
    if (translations[requestedLanguage]) return requestedLanguage;
    if (invite && translations[invite.language]) return invite.language;
    if (translations[browserLanguage]) return browserLanguage;
    return 'en';
  }

  applyLanguage(translations[requestedLanguage] ? requestedLanguage : 'en');

  loadInvite().then((invite) => {
    applyLanguage(resolveLanguage(invite));
    if (!invite) {
      document.getElementById('gate-view').hidden = false;
      return;
    }
    state.invite = invite;
    document.getElementById('company-name').value = invite.company;
    document.getElementById('work-email').value = invite.email;
    if (invite.customerReference) {
      document.getElementById('customer-reference').value = invite.customerReference;
      document.getElementById('reference-row').hidden = false;
    }
    document.getElementById('form-view').hidden = false;
    loadMetaSdk(state.language);
  });
})();
