(function () {
  'use strict';

  // Kundenseite fuer Instagram + E-Mail (26.09.2026). WhatsApp bleibt auf meta-connect.html;
  // der Kanal steckt signiert im Einladungs-Token und wird ueber /api/connect/invite gelesen.
  // Instagram: IG_CONFIG_ID nach Meta-Freigabe eintragen (Facebook-Login-for-Business-Konfiguration
  // fuer Instagram bzw. Instagram Login for Business). Scopes je Variante: instagram_basic,
  // instagram_manage_messages, pages_show_list, pages_manage_metadata  ODER  instagram_business_basic,
  // instagram_business_manage_messages. Bis dahin schaltet INSTAGRAM_SIGNUP_ENABLED (Vercel) die Ansicht.
  const IG_CONFIG_ID = '';

  const translations = {
    en: {
      dir: 'ltr', titlePage: 'HYBOTE – Connect', eyebrow: 'Secure account connection',
      titleEmail: 'Connect your mailbox to HYBOTE', titleInstagram: 'Connect Instagram to HYBOTE', title: 'Connect to HYBOTE',
      introEmail: 'Grant HYBOTE access to the mailbox that receives your customer inquiries. You sign in directly with your provider and can revoke the access at any time.',
      introInstagram: 'Authorize HYBOTE for the Instagram professional account of your business through the official Meta dialog.',
      intro: 'Grant HYBOTE access through your provider’s official sign-in. You stay in control and can revoke the access at any time.',
      trustLogin: 'Official provider sign-in', trustPassword: 'HYBOTE never sees your password', trustRevoke: 'Access can be revoked anytime',
      stepsTitle: 'How it works', step1Title: 'Choose your provider', step1Body: 'Microsoft 365 / Outlook, Google Workspace / Gmail or any other mailbox.',
      step2Title: 'Sign in with your provider', step2Body: 'The sign-in happens directly at Microsoft or Google. For other providers you enter the IMAP/SMTP details of your mailbox.',
      step3Title: 'Done', step3Body: 'HYBOTE stores only a revocable access permission and completes the technical activation.',
      prereqTitle: 'Before you start', prereq1: 'Access to the business mailbox that receives customer inquiries', prereq2: 'Microsoft 365: your IT administrator may need to approve the access', prereq3: 'Other providers: IMAP and SMTP settings plus an app password',
      gateTitle: 'Please use your personal invitation link', gateBody: 'This page can only be opened through the personal link HYBOTE sent you. If your link has expired, we will gladly send you a new one.', gateAction: 'Request a new link',
      providersTitle: 'Connect your mailbox', providersIntro: 'Choose the provider of the mailbox for',
      provMicrosoft: 'Microsoft 365 / Outlook', provMicrosoftSub: 'Sign in with your Microsoft account', provGoogle: 'Google Workspace / Gmail', provGoogleSub: 'Sign in with your Google account', provImap: 'Other provider', provImapSub: 'IMAP and SMTP with an app password',
      finePrintEmail: 'You sign in directly with your provider. HYBOTE only receives a revocable access permission for this mailbox.',
      imapTitle: 'Mailbox details', imapIntro: 'Enter the IMAP and SMTP settings of your mailbox. Use an app password if your provider offers one.',
      addressLabel: 'Mailbox address', userLabel: 'Username', userHint: '(usually the address)', passwordLabel: 'Password / app password', imapHostLabel: 'IMAP server', imapPortLabel: 'IMAP port', smtpHostLabel: 'SMTP server', smtpPortLabel: 'SMTP port', tlsLabel: 'Encrypted connection (SSL/TLS, recommended)',
      authority: 'I am authorized to connect this mailbox for the company named above.', privacyPrefix: 'I accept the', privacyLink: 'Privacy Policy', privacySuffix: 'and the processing of the connection data.',
      connectImap: 'Check and connect', connecting: 'Connecting …', backToProviders: 'Back to provider selection',
      igPendingTitle: 'Instagram connection is being enabled', igPendingBody: 'Meta is currently approving the Instagram permissions for HYBOTE. Your personal link stays valid: as soon as the approval is in place, this page will guide you through the connection. We will let you know.',
      igTitle: 'Connect Instagram', igIntro: 'Authorize HYBOTE for the Instagram professional account of your business.', igConnectButton: 'Connect with Instagram',
      successTitle: 'Mailbox connected', successBody: 'The access permission was securely delivered to HYBOTE. We will now complete the technical activation.', alreadyConnected: 'This mailbox is already connected to HYBOTE. Nothing else to do.',
      provider: 'Provider', address: 'Mailbox', connectedAt: 'Connected', backHome: 'Back to HYBOTE', support: 'Need help?', terms: 'Terms', deletion: 'Data deletion',
      invalidForm: 'Please fill in all fields and accept both confirmations.', sessionFailed: 'The secure session could not be started. Please reload the page.',
      imapFailed: 'The IMAP login failed. Please check server, port, username and app password.', smtpFailed: 'The SMTP login failed. Please check the SMTP server and port.',
      serverError: 'The connection could not be stored securely. Try again or contact HYBOTE.', oauthDenied: 'The sign-in was cancelled. No changes were made.', oauthFailed: 'The provider could not complete the sign-in. Please try again or contact HYBOTE.',
      stateInvalid: 'The sign-in session expired. Please start again from this page.', providerNotAllowed: 'This provider is not enabled for your invitation. Please contact HYBOTE.', notConfigured: 'This provider is not available yet. Please contact HYBOTE.',
      tooManyAttempts: 'Too many attempts. Please wait a few minutes.', inviteInvalid: 'Your invitation link is no longer valid. Please contact HYBOTE for a new one.', igNotEnabled: 'The Instagram connection is not enabled yet.'
    },
    de: {
      dir: 'ltr', titlePage: 'HYBOTE – Verbinden', eyebrow: 'Sichere Kontoverbindung',
      titleEmail: 'Postfach mit HYBOTE verbinden', titleInstagram: 'Instagram mit HYBOTE verbinden', title: 'Mit HYBOTE verbinden',
      introEmail: 'Geben Sie HYBOTE Zugriff auf das Postfach, in dem Ihre Kundenanfragen eingehen. Sie melden sich direkt bei Ihrem Anbieter an und können den Zugriff jederzeit widerrufen.',
      introInstagram: 'Autorisieren Sie HYBOTE über den offiziellen Meta-Dialog für das Instagram-Professional-Konto Ihres Unternehmens.',
      intro: 'Erteilen Sie HYBOTE den Zugriff über die offizielle Anmeldung Ihres Anbieters. Sie behalten die Kontrolle und können den Zugriff jederzeit widerrufen.',
      trustLogin: 'Offizielle Anbieter-Anmeldung', trustPassword: 'HYBOTE sieht Ihr Passwort nie', trustRevoke: 'Zugriff jederzeit widerrufbar',
      stepsTitle: 'So funktioniert es', step1Title: 'Anbieter wählen', step1Body: 'Microsoft 365 / Outlook, Google Workspace / Gmail oder ein beliebiges anderes Postfach.',
      step2Title: 'Bei Ihrem Anbieter anmelden', step2Body: 'Die Anmeldung erfolgt direkt bei Microsoft oder Google. Bei anderen Anbietern tragen Sie die IMAP/SMTP-Daten Ihres Postfachs ein.',
      step3Title: 'Fertig', step3Body: 'HYBOTE speichert nur eine widerrufbare Zugriffsberechtigung und übernimmt die technische Einrichtung.',
      prereqTitle: 'Bevor Sie starten', prereq1: 'Zugang zum geschäftlichen Postfach, in dem Kundenanfragen eingehen', prereq2: 'Microsoft 365: ggf. muss Ihr IT-Administrator den Zugriff freigeben', prereq3: 'Andere Anbieter: IMAP- und SMTP-Daten sowie ein App-Passwort',
      gateTitle: 'Bitte nutzen Sie Ihren persönlichen Einladungslink', gateBody: 'Diese Seite lässt sich nur über den persönlichen Link öffnen, den HYBOTE Ihnen geschickt hat. Ist Ihr Link abgelaufen, senden wir Ihnen gern einen neuen.', gateAction: 'Neuen Link anfordern',
      providersTitle: 'Postfach verbinden', providersIntro: 'Wählen Sie den Anbieter des Postfachs für',
      provMicrosoft: 'Microsoft 365 / Outlook', provMicrosoftSub: 'Anmeldung mit Ihrem Microsoft-Konto', provGoogle: 'Google Workspace / Gmail', provGoogleSub: 'Anmeldung mit Ihrem Google-Konto', provImap: 'Anderer Anbieter', provImapSub: 'IMAP und SMTP mit App-Passwort',
      finePrintEmail: 'Sie melden sich direkt bei Ihrem Anbieter an. HYBOTE erhält nur eine widerrufbare Zugriffsberechtigung für dieses Postfach.',
      imapTitle: 'Postfachdaten', imapIntro: 'Tragen Sie die IMAP- und SMTP-Daten Ihres Postfachs ein. Verwenden Sie ein App-Passwort, wenn Ihr Anbieter eines anbietet.',
      addressLabel: 'Postfachadresse', userLabel: 'Benutzername', userHint: '(meist die Adresse)', passwordLabel: 'Passwort / App-Passwort', imapHostLabel: 'IMAP-Server', imapPortLabel: 'IMAP-Port', smtpHostLabel: 'SMTP-Server', smtpPortLabel: 'SMTP-Port', tlsLabel: 'Verschlüsselte Verbindung (SSL/TLS, empfohlen)',
      authority: 'Ich bin berechtigt, dieses Postfach für das oben genannte Unternehmen zu verbinden.', privacyPrefix: 'Ich akzeptiere die', privacyLink: 'Datenschutzerklärung', privacySuffix: 'und die Verarbeitung der Verbindungsdaten.',
      connectImap: 'Prüfen und verbinden', connecting: 'Verbinde …', backToProviders: 'Zurück zur Anbieterwahl',
      igPendingTitle: 'Instagram-Anbindung wird freigeschaltet', igPendingBody: 'Meta prüft derzeit die Instagram-Berechtigungen für HYBOTE. Ihr persönlicher Link bleibt gültig: Sobald die Freigabe vorliegt, führt Sie diese Seite durch die Verbindung. Wir melden uns.',
      igTitle: 'Instagram verbinden', igIntro: 'Autorisieren Sie HYBOTE für das Instagram-Professional-Konto Ihres Unternehmens.', igConnectButton: 'Mit Instagram verbinden',
      successTitle: 'Postfach verbunden', successBody: 'Die Zugriffsberechtigung wurde sicher an HYBOTE übermittelt. Wir übernehmen jetzt die technische Einrichtung.', alreadyConnected: 'Dieses Postfach ist bereits mit HYBOTE verbunden. Es ist nichts weiter zu tun.',
      provider: 'Anbieter', address: 'Postfach', connectedAt: 'Verbunden', backHome: 'Zurück zu HYBOTE', support: 'Brauchen Sie Hilfe?', terms: 'AGB', deletion: 'Datenlöschung',
      invalidForm: 'Bitte alle Felder ausfüllen und beide Bestätigungen setzen.', sessionFailed: 'Die sichere Sitzung konnte nicht gestartet werden. Bitte Seite neu laden.',
      imapFailed: 'Die IMAP-Anmeldung ist fehlgeschlagen. Bitte Server, Port, Benutzername und App-Passwort prüfen.', smtpFailed: 'Die SMTP-Anmeldung ist fehlgeschlagen. Bitte SMTP-Server und Port prüfen.',
      serverError: 'Die Verbindung konnte nicht sicher gespeichert werden. Bitte erneut versuchen oder HYBOTE kontaktieren.', oauthDenied: 'Die Anmeldung wurde abgebrochen. Es wurde nichts geändert.', oauthFailed: 'Der Anbieter konnte die Anmeldung nicht abschließen. Bitte erneut versuchen oder HYBOTE kontaktieren.',
      stateInvalid: 'Die Anmeldesitzung ist abgelaufen. Bitte hier neu starten.', providerNotAllowed: 'Dieser Anbieter ist für Ihre Einladung nicht freigegeben. Bitte HYBOTE kontaktieren.', notConfigured: 'Dieser Anbieter ist noch nicht verfügbar. Bitte HYBOTE kontaktieren.',
      tooManyAttempts: 'Zu viele Versuche. Bitte einige Minuten warten.', inviteInvalid: 'Ihr Einladungslink ist nicht mehr gültig. Bitte HYBOTE um einen neuen bitten.', igNotEnabled: 'Die Instagram-Anbindung ist noch nicht freigeschaltet.'
    },
    ar: {
      dir: 'rtl', titlePage: 'HYBOTE – الربط', eyebrow: 'ربط آمن للحساب',
      titleEmail: 'ربط صندوق البريد مع HYBOTE', titleInstagram: 'ربط إنستغرام مع HYBOTE', title: 'الربط مع HYBOTE',
      introEmail: 'امنحوا HYBOTE صلاحية الوصول إلى صندوق البريد الذي تصل إليه استفسارات عملائكم. تسجلون الدخول مباشرة لدى مزود الخدمة ويمكنكم إلغاء الصلاحية في أي وقت.',
      introInstagram: 'فوّضوا HYBOTE عبر نافذة Meta الرسمية لحساب إنستغرام الاحترافي الخاص بشركتكم.',
      intro: 'امنحوا HYBOTE الصلاحية عبر تسجيل الدخول الرسمي لدى مزود الخدمة. تبقى السيطرة لديكم ويمكنكم إلغاء الصلاحية في أي وقت.',
      trustLogin: 'تسجيل دخول رسمي لدى المزود', trustPassword: 'لا ترى HYBOTE كلمة المرور أبداً', trustRevoke: 'يمكن إلغاء الصلاحية في أي وقت',
      stepsTitle: 'كيف يعمل', step1Title: 'اختيار المزود', step1Body: 'Microsoft 365 / Outlook أو Google Workspace / Gmail أو أي صندوق بريد آخر.',
      step2Title: 'تسجيل الدخول لدى المزود', step2Body: 'يتم تسجيل الدخول مباشرة لدى Microsoft أو Google. لدى المزودين الآخرين تُدخلون بيانات IMAP/SMTP لصندوق البريد.',
      step3Title: 'تم', step3Body: 'تحفظ HYBOTE صلاحية وصول قابلة للإلغاء فقط وتتولى التفعيل التقني.',
      prereqTitle: 'قبل البدء', prereq1: 'الوصول إلى صندوق بريد العمل الذي تصل إليه استفسارات العملاء', prereq2: 'Microsoft 365: قد يلزم موافقة مسؤول تقنية المعلومات', prereq3: 'مزودون آخرون: بيانات IMAP و SMTP وكلمة مرور تطبيق',
      gateTitle: 'يرجى استخدام رابط الدعوة الشخصي', gateBody: 'لا يمكن فتح هذه الصفحة إلا عبر الرابط الشخصي الذي أرسلته HYBOTE إليكم. إذا انتهت صلاحية الرابط، سنرسل لكم رابطاً جديداً بكل سرور.', gateAction: 'طلب رابط جديد',
      providersTitle: 'ربط صندوق البريد', providersIntro: 'اختاروا مزود صندوق البريد لـ',
      provMicrosoft: 'Microsoft 365 / Outlook', provMicrosoftSub: 'تسجيل الدخول بحساب Microsoft', provGoogle: 'Google Workspace / Gmail', provGoogleSub: 'تسجيل الدخول بحساب Google', provImap: 'مزود آخر', provImapSub: 'IMAP و SMTP مع كلمة مرور تطبيق',
      finePrintEmail: 'تسجلون الدخول مباشرة لدى مزود الخدمة. تحصل HYBOTE على صلاحية وصول قابلة للإلغاء لهذا الصندوق فقط.',
      imapTitle: 'بيانات صندوق البريد', imapIntro: 'أدخلوا بيانات IMAP و SMTP لصندوق البريد. استخدموا كلمة مرور تطبيق إن كان المزود يوفرها.',
      addressLabel: 'عنوان صندوق البريد', userLabel: 'اسم المستخدم', userHint: '(عادةً العنوان)', passwordLabel: 'كلمة المرور / كلمة مرور التطبيق', imapHostLabel: 'خادم IMAP', imapPortLabel: 'منفذ IMAP', smtpHostLabel: 'خادم SMTP', smtpPortLabel: 'منفذ SMTP', tlsLabel: 'اتصال مشفر (SSL/TLS، موصى به)',
      authority: 'أنا مخوّل بربط هذا الصندوق للشركة المذكورة أعلاه.', privacyPrefix: 'أوافق على', privacyLink: 'سياسة الخصوصية', privacySuffix: 'ومعالجة بيانات الربط.',
      connectImap: 'التحقق والربط', connecting: 'جارٍ الربط …', backToProviders: 'العودة إلى اختيار المزود',
      igPendingTitle: 'يتم تفعيل ربط إنستغرام', igPendingBody: 'تقوم Meta حالياً بمراجعة صلاحيات إنستغرام لـ HYBOTE. يبقى رابطكم الشخصي صالحاً: بمجرد توفر الموافقة سترشدكم هذه الصفحة خلال الربط. سنتواصل معكم.',
      igTitle: 'ربط إنستغرام', igIntro: 'فوّضوا HYBOTE لحساب إنستغرام الاحترافي الخاص بشركتكم.', igConnectButton: 'الربط مع إنستغرام',
      successTitle: 'تم ربط صندوق البريد', successBody: 'تم إرسال صلاحية الوصول بأمان إلى HYBOTE. سنتولى الآن التفعيل التقني.', alreadyConnected: 'هذا الصندوق مرتبط بالفعل مع HYBOTE. لا حاجة لأي إجراء إضافي.',
      provider: 'المزود', address: 'صندوق البريد', connectedAt: 'تم الربط', backHome: 'العودة إلى HYBOTE', support: 'هل تحتاجون مساعدة؟', terms: 'الشروط', deletion: 'حذف البيانات',
      invalidForm: 'يرجى تعبئة جميع الحقول والموافقة على التأكيدين.', sessionFailed: 'تعذر بدء الجلسة الآمنة. يرجى إعادة تحميل الصفحة.',
      imapFailed: 'فشل تسجيل الدخول عبر IMAP. يرجى التحقق من الخادم والمنفذ واسم المستخدم وكلمة مرور التطبيق.', smtpFailed: 'فشل تسجيل الدخول عبر SMTP. يرجى التحقق من خادم SMTP والمنفذ.',
      serverError: 'تعذر حفظ الربط بأمان. حاولوا مجدداً أو تواصلوا مع HYBOTE.', oauthDenied: 'تم إلغاء تسجيل الدخول. لم يتم تغيير أي شيء.', oauthFailed: 'لم يتمكن المزود من إتمام تسجيل الدخول. حاولوا مجدداً أو تواصلوا مع HYBOTE.',
      stateInvalid: 'انتهت جلسة تسجيل الدخول. يرجى البدء من جديد من هذه الصفحة.', providerNotAllowed: 'هذا المزود غير مفعّل لدعوتكم. يرجى التواصل مع HYBOTE.', notConfigured: 'هذا المزود غير متاح حالياً. يرجى التواصل مع HYBOTE.',
      tooManyAttempts: 'محاولات كثيرة. يرجى الانتظار بضع دقائق.', inviteInvalid: 'رابط الدعوة لم يعد صالحاً. يرجى طلب رابط جديد من HYBOTE.', igNotEnabled: 'ربط إنستغرام غير مفعّل بعد.'
    },
    ru: {
      dir: 'ltr', titlePage: 'HYBOTE – Подключение', eyebrow: 'Безопасное подключение аккаунта',
      titleEmail: 'Подключить почтовый ящик к HYBOTE', titleInstagram: 'Подключить Instagram к HYBOTE', title: 'Подключение к HYBOTE',
      introEmail: 'Предоставьте HYBOTE доступ к почтовому ящику, в который поступают запросы клиентов. Вы входите напрямую у своего провайдера и можете отозвать доступ в любой момент.',
      introInstagram: 'Авторизуйте HYBOTE через официальный диалог Meta для профессионального аккаунта Instagram вашей компании.',
      intro: 'Предоставьте HYBOTE доступ через официальный вход у вашего провайдера. Вы сохраняете контроль и можете отозвать доступ в любой момент.',
      trustLogin: 'Официальный вход у провайдера', trustPassword: 'HYBOTE никогда не видит ваш пароль', trustRevoke: 'Доступ можно отозвать в любой момент',
      stepsTitle: 'Как это работает', step1Title: 'Выберите провайдера', step1Body: 'Microsoft 365 / Outlook, Google Workspace / Gmail или любой другой почтовый ящик.',
      step2Title: 'Войдите у провайдера', step2Body: 'Вход выполняется напрямую у Microsoft или Google. Для других провайдеров вы вводите данные IMAP/SMTP вашего ящика.',
      step3Title: 'Готово', step3Body: 'HYBOTE сохраняет только отзываемое разрешение на доступ и выполняет техническую активацию.',
      prereqTitle: 'Перед началом', prereq1: 'Доступ к рабочему почтовому ящику, в который поступают запросы клиентов', prereq2: 'Microsoft 365: может потребоваться одобрение IT-администратора', prereq3: 'Другие провайдеры: данные IMAP и SMTP и пароль приложения',
      gateTitle: 'Пожалуйста, используйте вашу персональную ссылку-приглашение', gateBody: 'Эту страницу можно открыть только по персональной ссылке, которую вам отправила HYBOTE. Если ссылка истекла, мы с радостью отправим новую.', gateAction: 'Запросить новую ссылку',
      providersTitle: 'Подключить почтовый ящик', providersIntro: 'Выберите провайдера почтового ящика для',
      provMicrosoft: 'Microsoft 365 / Outlook', provMicrosoftSub: 'Вход через аккаунт Microsoft', provGoogle: 'Google Workspace / Gmail', provGoogleSub: 'Вход через аккаунт Google', provImap: 'Другой провайдер', provImapSub: 'IMAP и SMTP с паролем приложения',
      finePrintEmail: 'Вы входите напрямую у своего провайдера. HYBOTE получает только отзываемое разрешение на доступ к этому ящику.',
      imapTitle: 'Данные почтового ящика', imapIntro: 'Введите настройки IMAP и SMTP вашего ящика. Используйте пароль приложения, если провайдер его предлагает.',
      addressLabel: 'Адрес почтового ящика', userLabel: 'Имя пользователя', userHint: '(обычно адрес)', passwordLabel: 'Пароль / пароль приложения', imapHostLabel: 'Сервер IMAP', imapPortLabel: 'Порт IMAP', smtpHostLabel: 'Сервер SMTP', smtpPortLabel: 'Порт SMTP', tlsLabel: 'Зашифрованное соединение (SSL/TLS, рекомендуется)',
      authority: 'Я уполномочен(а) подключить этот почтовый ящик для указанной выше компании.', privacyPrefix: 'Я принимаю', privacyLink: 'Политику конфиденциальности', privacySuffix: 'и обработку данных подключения.',
      connectImap: 'Проверить и подключить', connecting: 'Подключение …', backToProviders: 'Назад к выбору провайдера',
      igPendingTitle: 'Подключение Instagram активируется', igPendingBody: 'Meta в настоящее время проверяет разрешения Instagram для HYBOTE. Ваша персональная ссылка остаётся действительной: как только одобрение будет получено, эта страница проведёт вас через подключение. Мы сообщим вам.',
      igTitle: 'Подключить Instagram', igIntro: 'Авторизуйте HYBOTE для профессионального аккаунта Instagram вашей компании.', igConnectButton: 'Подключить через Instagram',
      successTitle: 'Почтовый ящик подключён', successBody: 'Разрешение на доступ безопасно передано HYBOTE. Теперь мы выполним техническую активацию.', alreadyConnected: 'Этот почтовый ящик уже подключён к HYBOTE. Больше ничего делать не нужно.',
      provider: 'Провайдер', address: 'Почтовый ящик', connectedAt: 'Подключено', backHome: 'Назад к HYBOTE', support: 'Нужна помощь?', terms: 'Условия', deletion: 'Удаление данных',
      invalidForm: 'Пожалуйста, заполните все поля и подтвердите оба пункта.', sessionFailed: 'Не удалось начать защищённую сессию. Пожалуйста, перезагрузите страницу.',
      imapFailed: 'Вход по IMAP не удался. Проверьте сервер, порт, имя пользователя и пароль приложения.', smtpFailed: 'Вход по SMTP не удался. Проверьте сервер SMTP и порт.',
      serverError: 'Не удалось безопасно сохранить подключение. Попробуйте ещё раз или свяжитесь с HYBOTE.', oauthDenied: 'Вход был отменён. Ничего не изменено.', oauthFailed: 'Провайдер не смог завершить вход. Попробуйте ещё раз или свяжитесь с HYBOTE.',
      stateInvalid: 'Сессия входа истекла. Пожалуйста, начните заново с этой страницы.', providerNotAllowed: 'Этот провайдер не включён для вашего приглашения. Свяжитесь с HYBOTE.', notConfigured: 'Этот провайдер пока недоступен. Свяжитесь с HYBOTE.',
      tooManyAttempts: 'Слишком много попыток. Подождите несколько минут.', inviteInvalid: 'Ваша ссылка-приглашение больше недействительна. Запросите новую у HYBOTE.', igNotEnabled: 'Подключение Instagram ещё не активировано.'
    },
    fr: {
      dir: 'ltr', titlePage: 'HYBOTE – Connexion', eyebrow: 'Connexion sécurisée du compte',
      titleEmail: 'Connecter votre messagerie à HYBOTE', titleInstagram: 'Connecter Instagram à HYBOTE', title: 'Se connecter à HYBOTE',
      introEmail: 'Accordez à HYBOTE l’accès à la boîte mail qui reçoit vos demandes clients. Vous vous connectez directement chez votre fournisseur et pouvez révoquer l’accès à tout moment.',
      introInstagram: 'Autorisez HYBOTE via la boîte de dialogue officielle de Meta pour le compte Instagram professionnel de votre entreprise.',
      intro: 'Accordez l’accès à HYBOTE via la connexion officielle de votre fournisseur. Vous gardez le contrôle et pouvez révoquer l’accès à tout moment.',
      trustLogin: 'Connexion officielle du fournisseur', trustPassword: 'HYBOTE ne voit jamais votre mot de passe', trustRevoke: 'Accès révocable à tout moment',
      stepsTitle: 'Comment ça marche', step1Title: 'Choisissez votre fournisseur', step1Body: 'Microsoft 365 / Outlook, Google Workspace / Gmail ou toute autre boîte mail.',
      step2Title: 'Connectez-vous chez votre fournisseur', step2Body: 'La connexion se fait directement chez Microsoft ou Google. Pour les autres fournisseurs, saisissez les paramètres IMAP/SMTP de votre boîte.',
      step3Title: 'Terminé', step3Body: 'HYBOTE n’enregistre qu’une autorisation d’accès révocable et finalise l’activation technique.',
      prereqTitle: 'Avant de commencer', prereq1: 'Accès à la boîte mail professionnelle qui reçoit les demandes clients', prereq2: 'Microsoft 365 : votre administrateur IT devra peut-être approuver l’accès', prereq3: 'Autres fournisseurs : paramètres IMAP et SMTP et un mot de passe d’application',
      gateTitle: 'Veuillez utiliser votre lien d’invitation personnel', gateBody: 'Cette page ne peut être ouverte qu’avec le lien personnel que HYBOTE vous a envoyé. Si votre lien a expiré, nous vous en enverrons volontiers un nouveau.', gateAction: 'Demander un nouveau lien',
      providersTitle: 'Connecter votre boîte mail', providersIntro: 'Choisissez le fournisseur de la boîte mail pour',
      provMicrosoft: 'Microsoft 365 / Outlook', provMicrosoftSub: 'Connexion avec votre compte Microsoft', provGoogle: 'Google Workspace / Gmail', provGoogleSub: 'Connexion avec votre compte Google', provImap: 'Autre fournisseur', provImapSub: 'IMAP et SMTP avec un mot de passe d’application',
      finePrintEmail: 'Vous vous connectez directement chez votre fournisseur. HYBOTE ne reçoit qu’une autorisation d’accès révocable pour cette boîte.',
      imapTitle: 'Paramètres de la boîte mail', imapIntro: 'Saisissez les paramètres IMAP et SMTP de votre boîte. Utilisez un mot de passe d’application si votre fournisseur en propose.',
      addressLabel: 'Adresse de la boîte', userLabel: 'Nom d’utilisateur', userHint: '(généralement l’adresse)', passwordLabel: 'Mot de passe / mot de passe d’application', imapHostLabel: 'Serveur IMAP', imapPortLabel: 'Port IMAP', smtpHostLabel: 'Serveur SMTP', smtpPortLabel: 'Port SMTP', tlsLabel: 'Connexion chiffrée (SSL/TLS, recommandé)',
      authority: 'Je suis autorisé(e) à connecter cette boîte mail pour l’entreprise indiquée ci-dessus.', privacyPrefix: 'J’accepte la', privacyLink: 'Politique de confidentialité', privacySuffix: 'et le traitement des données de connexion.',
      connectImap: 'Vérifier et connecter', connecting: 'Connexion …', backToProviders: 'Retour au choix du fournisseur',
      igPendingTitle: 'La connexion Instagram est en cours d’activation', igPendingBody: 'Meta examine actuellement les autorisations Instagram pour HYBOTE. Votre lien personnel reste valable : dès que l’autorisation sera accordée, cette page vous guidera dans la connexion. Nous vous tiendrons informé.',
      igTitle: 'Connecter Instagram', igIntro: 'Autorisez HYBOTE pour le compte Instagram professionnel de votre entreprise.', igConnectButton: 'Se connecter avec Instagram',
      successTitle: 'Boîte mail connectée', successBody: 'L’autorisation d’accès a été transmise en toute sécurité à HYBOTE. Nous finalisons maintenant l’activation technique.', alreadyConnected: 'Cette boîte mail est déjà connectée à HYBOTE. Rien d’autre à faire.',
      provider: 'Fournisseur', address: 'Boîte mail', connectedAt: 'Connecté', backHome: 'Retour à HYBOTE', support: 'Besoin d’aide ?', terms: 'CGV', deletion: 'Suppression des données',
      invalidForm: 'Veuillez remplir tous les champs et cocher les deux confirmations.', sessionFailed: 'La session sécurisée n’a pas pu démarrer. Veuillez recharger la page.',
      imapFailed: 'La connexion IMAP a échoué. Vérifiez le serveur, le port, le nom d’utilisateur et le mot de passe d’application.', smtpFailed: 'La connexion SMTP a échoué. Vérifiez le serveur SMTP et le port.',
      serverError: 'La connexion n’a pas pu être enregistrée en toute sécurité. Réessayez ou contactez HYBOTE.', oauthDenied: 'La connexion a été annulée. Aucune modification n’a été effectuée.', oauthFailed: 'Le fournisseur n’a pas pu finaliser la connexion. Réessayez ou contactez HYBOTE.',
      stateInvalid: 'La session de connexion a expiré. Veuillez recommencer depuis cette page.', providerNotAllowed: 'Ce fournisseur n’est pas activé pour votre invitation. Veuillez contacter HYBOTE.', notConfigured: 'Ce fournisseur n’est pas encore disponible. Veuillez contacter HYBOTE.',
      tooManyAttempts: 'Trop de tentatives. Veuillez patienter quelques minutes.', inviteInvalid: 'Votre lien d’invitation n’est plus valable. Veuillez demander un nouveau lien à HYBOTE.', igNotEnabled: 'La connexion Instagram n’est pas encore activée.'
    }
  };

  const ERROR_KEYS = {
    INVITE_INVALID: 'inviteInvalid', INVITE_CHANNEL_MISMATCH: 'inviteInvalid', PROVIDER_NOT_ALLOWED: 'providerNotAllowed',
    NOT_CONFIGURED: 'notConfigured', TOO_MANY_ATTEMPTS: 'tooManyAttempts', OAUTH_DENIED: 'oauthDenied', OAUTH_FAILED: 'oauthFailed',
    STATE_INVALID: 'stateInvalid', SERVER_ERROR: 'serverError', IMAP_FAILED: 'imapFailed', SMTP_FAILED: 'smtpFailed',
    INVALID_FORM: 'invalidForm', CSRF_VALIDATION_FAILED: 'sessionFailed', SESSION_FAILED: 'sessionFailed', INSTAGRAM_NOT_ENABLED: 'igNotEnabled', METHOD_NOT_ALLOWED: 'serverError'
  };
  const PROVIDER_LABELS = { microsoft: 'provMicrosoft', google: 'provGoogle', imap: 'provImap' };

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite') || '';
  const state = { language: 'en', invite: null, flags: {}, csrfToken: '' };
  const $ = (id) => document.getElementById(id);
  const t = (key) => (translations[state.language] && translations[state.language][key]) || translations.en[key] || key;

  function applyLanguage(language) {
    state.language = translations[language] ? language : 'en';
    const dict = translations[state.language];
    document.documentElement.lang = state.language;
    document.documentElement.dir = dict.dir;
    document.title = dict.titlePage;
    document.querySelectorAll('[data-i18n]').forEach((el) => { const key = el.dataset.i18n; if (dict[key]) el.textContent = dict[key]; });
    document.querySelectorAll('.lang-pill').forEach((pill) => pill.classList.toggle('active', pill.dataset.setLang === state.language));
    document.querySelectorAll('[data-legal], #privacy-link').forEach((link) => {
      const url = new URL(link.getAttribute('href'), window.location.origin); url.searchParams.set('lang', state.language); link.setAttribute('href', url.pathname + url.search);
    });
    applyChannelTexts();
  }

  function applyChannelTexts() {
    const channel = state.invite ? state.invite.channel : '';
    if (channel === 'email') { $('page-title').textContent = t('titleEmail'); document.querySelector('.intro-copy').textContent = t('introEmail'); }
    else if (channel === 'instagram') { $('page-title').textContent = t('titleInstagram'); document.querySelector('.intro-copy').textContent = t('introInstagram'); }
  }

  function showView(id) {
    ['gate-view', 'providers-view', 'imap-view', 'instagram-pending-view', 'instagram-view', 'success-view'].forEach((v) => { $(v).hidden = v !== id; });
  }
  function showError(box, code) { box.textContent = t(ERROR_KEYS[code] || 'serverError'); box.hidden = false; }
  function clearError(box) { box.hidden = true; box.textContent = ''; }

  async function fetchJson(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(options && options.headers ? options.headers : {}) }, ...(options || {}) });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, payload };
  }

  async function loadInvite() {
    if (!inviteToken) return null;
    const { ok, payload } = await fetchJson(`/api/connect/invite?token=${encodeURIComponent(inviteToken)}`);
    if (!ok || !payload.ok) return null;
    state.flags = payload.flags || {};
    return payload.invite;
  }

  async function loadStatus() {
    const { ok, payload } = await fetchJson(`/api/connect/status?token=${encodeURIComponent(inviteToken)}`);
    return ok && payload.ok ? payload : null;
  }

  function showSuccess(status, already) {
    const summary = $('connection-summary');
    const rows = [];
    if (status && status.provider) rows.push([t('provider'), t(PROVIDER_LABELS[status.provider] || 'provImap'), 'auto']);
    if (status && status.address) rows.push([t('address'), status.address, 'ltr']);
    if (status && status.connectedAt) rows.push([t('connectedAt'), new Intl.DateTimeFormat(state.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(status.connectedAt)), 'auto']);
    summary.replaceChildren(...rows.map(([label, value, direction]) => {
      const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; if (direction === 'ltr') dd.dir = 'ltr'; row.append(dt, dd); return row;
    }));
    summary.hidden = rows.length === 0;
    $('success-body').textContent = already ? t('alreadyConnected') : t('successBody');
    showView('success-view');
  }

  function renderProviders() {
    const allowed = state.invite.providers || ['microsoft', 'google', 'imap'];
    $('company-label').textContent = state.invite.company;
    document.querySelectorAll('.provider-button').forEach((button) => {
      const provider = button.dataset.provider;
      button.hidden = !allowed.includes(provider);
      const available = provider === 'imap' ? state.flags.mailConfigured !== false : Boolean(state.flags[provider]);
      button.disabled = !available;
      button.title = available ? '' : t('notConfigured');
    });
    const errorCode = params.get('error');
    if (errorCode) showError($('form-error'), errorCode); else clearError($('form-error'));
    showView('providers-view');
  }

  document.querySelectorAll('.provider-button').forEach((button) => {
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      if (provider === 'imap') { $('imap-address').value = state.invite.email || ''; clearError($('imap-error')); showView('imap-view'); return; }
      window.location.assign(`/api/connect/${provider === 'microsoft' ? 'ms' : 'google'}/start?invite=${encodeURIComponent(inviteToken)}`);
    });
  });
  $('imap-back').addEventListener('click', () => renderProviders());

  $('imap-tls').addEventListener('change', (event) => {
    if ($('imap-port').value === '993' || $('imap-port').value === '143') $('imap-port').value = event.target.checked ? '993' : '143';
    if ($('smtp-port').value === '465' || $('smtp-port').value === '587') $('smtp-port').value = event.target.checked ? '465' : '587';
  });

  function setLoading(button, loading) {
    button.disabled = loading; button.classList.toggle('loading', loading);
    button.querySelector('.button-label').textContent = loading ? t('connecting') : t(button.id === 'imap-button' ? 'connectImap' : 'igConnectButton');
  }

  $('imap-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = $('imap-error'); clearError(errorBox);
    const address = $('imap-address').value.trim(); const password = $('imap-password').value;
    const imapHost = $('imap-host').value.trim(); const smtpHost = $('smtp-host').value.trim();
    if (!address || !password || !imapHost || !smtpHost || !$('authority-check').checked || !$('privacy-check').checked) { showError(errorBox, 'INVALID_FORM'); return; }
    const button = $('imap-button'); setLoading(button, true);
    try {
      if (!state.csrfToken) {
        const { ok, payload } = await fetchJson('/api/connect/session', { method: 'POST' });
        if (!ok || !payload.csrfToken) throw new Error('SESSION_FAILED');
        state.csrfToken = payload.csrfToken;
      }
      const secure = $('imap-tls').checked;
      const { ok, payload } = await fetchJson('/api/connect/imap/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HYBOTE-CSRF': state.csrfToken },
        body: JSON.stringify({
          inviteToken, address, user: $('imap-user').value.trim() || address, password,
          imapHost, imapPort: $('imap-port').value.trim(), imapSecure: secure, smtpHost, smtpPort: $('smtp-port').value.trim(), smtpSecure: secure,
          authorityAccepted: true, privacyAccepted: true
        })
      });
      if (!ok || !payload.ok) throw new Error(payload.code || 'SERVER_ERROR');
      $('imap-password').value = '';
      showSuccess({ provider: 'imap', address: payload.address, connectedAt: new Date().toISOString() }, false);
    } catch (error) {
      showError(errorBox, error.message);
    } finally {
      setLoading(button, false);
    }
  });

  $('ig-button').addEventListener('click', async () => {
    const errorBox = $('ig-error'); clearError(errorBox);
    if (!IG_CONFIG_ID) { showError(errorBox, 'INSTAGRAM_NOT_ENABLED'); return; }
    const { ok, payload } = await fetchJson('/api/connect/ig/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteToken }) });
    if (!ok || !payload.ok) showError(errorBox, payload.code || 'SERVER_ERROR');
  });

  document.querySelectorAll('[data-set-lang]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', () => {
      const next = new URLSearchParams(window.location.search); next.set('lang', buttonElement.dataset.setLang); window.location.search = next.toString();
    });
  });

  const requestedLanguage = params.get('lang');
  const browserLanguage = (navigator.language || '').slice(0, 2);
  function resolveLanguage(invite) {
    if (translations[requestedLanguage]) return requestedLanguage;
    if (invite && translations[invite.language]) return invite.language;
    if (translations[browserLanguage]) return browserLanguage;
    return 'en';
  }

  applyLanguage(translations[requestedLanguage] ? requestedLanguage : 'en');

  loadInvite().then(async (invite) => {
    state.invite = invite;
    applyLanguage(resolveLanguage(invite));
    if (!invite) { showView('gate-view'); return; }
    if (invite.channel === 'whatsapp') {
      // Sicherheitsnetz: WhatsApp-Links gehoeren auf die Meta-Seite.
      const next = new URLSearchParams(window.location.search); window.location.replace(`/meta-connect.html?${next.toString()}`); return;
    }
    if (invite.channel === 'instagram') { showView(state.flags.instagramEnabled && IG_CONFIG_ID ? 'instagram-view' : 'instagram-pending-view'); return; }
    // E-Mail: erst Verbindungsstand (Redirect-Ergebnis oder Wiederbesuch), dann Anbieterwahl.
    const status = await loadStatus();
    if (status && status.connected) { showSuccess(status, params.get('result') !== 'ok'); return; }
    if (params.get('result') === 'ok') { showSuccess(status || {}, false); return; }
    renderProviders();
  });
})();
