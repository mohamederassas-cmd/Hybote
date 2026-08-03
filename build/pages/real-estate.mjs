// Landingpage: Immobilienmakler.
// Zahlen aus dem bestehenden Case ex.c1.* in index.html, damit Startseite und
// Landingpage dieselbe Rechnung zeigen.

export default {
  slug: 'real-estate',

  meta: {
    title: {
      en: 'AI for Real Estate Agencies | Every Enquiry Answered | HYBOTE',
      de: 'KI für Immobilienmakler | Jede Anfrage beantwortet | HYBOTE',
      ar: 'الذكاء الاصطناعي لوكالات العقارات | الرد على كل استفسار | HYBOTE',
    },
    desc: {
      en: 'Portal enquiries at 10pm, viewing requests at the weekend. HYBOTE answers and qualifies every property enquiry immediately, on WhatsApp, phone and email. Book a free intro call.',
      de: 'Portalanfragen um 22 Uhr, Besichtigungswünsche am Wochenende. HYBOTE beantwortet und qualifiziert jede Immobilienanfrage sofort, auf WhatsApp, Telefon und E-Mail. Kostenloses Kennenlerngespräch buchen.',
      ar: 'استفسارات المنصات في العاشرة مساءً وطلبات المعاينة في عطلة نهاية الأسبوع. يرد HYBOTE على كل استفسار عقاري ويؤهله فوراً عبر واتساب والهاتف والبريد الإلكتروني. احجز مكالمة تعارف مجانية.',
    },
    keywords: 'AI for real estate agents, real estate lead response, property enquiry automation, WhatsApp assistant estate agency, viewing appointment booking AI, KI Immobilienmakler',
    lead: { en: 'Real estate agencies', de: 'Immobilienmakler', ar: 'وكالات العقارات' },
    serviceName: {
      en: 'AI enquiry response for real estate agencies',
      de: 'KI-Anfragebearbeitung für Immobilienmakler',
      ar: 'الرد الآلي على الاستفسارات لوكالات العقارات',
    },
  },

  content: {
    hero: {
      badge: {
        en: 'System live · active 24/7',
        de: 'System live · aktiv rund um die Uhr',
        ar: 'النظام يعمل · متاح على مدار الساعة',
      },
      eyebrow: {
        en: 'FOR REAL ESTATE AGENCIES · AI AUTOMATION',
        de: 'FÜR IMMOBILIENMAKLER · KI-AUTOMATISIERUNG',
        ar: 'لوكالات العقارات · أتمتة الذكاء الاصطناعي',
      },
      h1: {
        en: 'Every property enquiry<br/><span class="grad-text" style="font-style:italic;">answered immediately.</span>',
        de: 'Jede Immobilienanfrage<br/><span class="grad-text" style="font-style:italic;">sofort beantwortet.</span>',
        ar: 'كل استفسار عقاري<br/><span class="grad-text" style="font-style:italic;">يُجاب فوراً.</span>',
      },
      sub: {
        en: 'Portal enquiries do not arrive during office hours. HYBOTE replies, answers questions about the listing, qualifies the prospect and books the viewing, <strong style="font-weight:400;color:var(--fg);">at any hour, on any channel.</strong>',
        de: 'Portalanfragen kommen nicht zu Bürozeiten. HYBOTE antwortet, beantwortet Fragen zum Objekt, qualifiziert den Interessenten und vereinbart die Besichtigung, <strong style="font-weight:400;color:var(--fg);">zu jeder Uhrzeit, auf jedem Kanal.</strong>',
        ar: 'استفسارات المنصات لا تصل في ساعات العمل. يرد HYBOTE ويجيب عن أسئلة العقار ويؤهل المهتم ويحدد موعد المعاينة، <strong style="font-weight:400;color:var(--fg);">في أي وقت وعلى أي قناة.</strong>',
      },
      cta1: { en: 'Free intro call', de: 'Kostenloses Kennenlerngespräch', ar: 'مكالمة تعارف مجانية' },
      cta2: { en: 'See the numbers', de: 'Zahlen ansehen', ar: 'اطّلع على الأرقام' },
    },

    problem: {
      label: { en: 'The situation', de: 'Die Ausgangslage', ar: 'الوضع الحالي' },
      h2: {
        en: 'The enquiry arrives at 21:47.<br/><em>You reply on Monday.</em>',
        de: 'Die Anfrage kommt um 21:47 Uhr.<br/><em>Sie antworten am Montag.</em>',
        ar: 'يصل الاستفسار في الساعة 21:47.<br/><em>وتردّ يوم الاثنين.</em>',
      },
      sub: {
        en: 'Property portals send enquiries around the clock. Whoever answers first gets the viewing, and whoever gets the viewing usually gets the contract.',
        de: 'Immobilienportale liefern Anfragen rund um die Uhr. Wer zuerst antwortet, bekommt die Besichtigung, und wer die Besichtigung bekommt, bekommt meist den Auftrag.',
        ar: 'منصات العقارات ترسل الاستفسارات على مدار الساعة. من يرد أولاً يحصل على المعاينة، ومن يحصل على المعاينة يحصل غالباً على العقد.',
      },
      items: [
        {
          t: { en: 'The evening gap', de: 'Die Abendlücke', ar: 'فجوة المساء' },
          d: {
            en: 'Most portal enquiries land between 18:00 and 23:00, and at weekends. By Monday morning the prospect has written to four other agencies and already has two viewing appointments.',
            de: 'Die meisten Portalanfragen landen zwischen 18 und 23 Uhr sowie am Wochenende. Bis Montagmorgen hat der Interessent vier weitere Makler angeschrieben und bereits zwei Besichtigungstermine.',
            ar: 'تصل معظم استفسارات المنصات بين السادسة والحادية عشرة مساءً وفي عطلة نهاية الأسبوع. وبحلول صباح الاثنين يكون المهتم قد راسل أربع وكالات أخرى وحجز موعدَي معاينة.',
          },
        },
        {
          t: { en: 'The same five questions', de: 'Die immer gleichen fünf Fragen', ar: 'الأسئلة الخمسة نفسها' },
          d: {
            en: 'Service charge, year built, energy certificate, availability, financing status. Your team types the same answers dozens of times a week instead of preparing valuations and closings.',
            de: 'Hausgeld, Baujahr, Energieausweis, Verfügbarkeit, Finanzierungsstand. Ihr Team tippt dieselben Antworten dutzendfach pro Woche, statt Wertermittlungen und Abschlüsse vorzubereiten.',
            ar: 'رسوم الخدمة وسنة البناء وشهادة الطاقة والتوفر وحالة التمويل. يكتب فريقك الإجابات نفسها عشرات المرات أسبوعياً بدل التحضير للتقييمات وإتمام الصفقات.',
          },
        },
        {
          t: { en: 'Unqualified viewings', de: 'Unqualifizierte Besichtigungen', ar: 'معاينات غير مؤهلة' },
          d: {
            en: 'Three of five viewing slots go to people without financing confirmation or genuine intent. That is travel time, key handling and Saturday hours spent on prospects who will never buy.',
            de: 'Drei von fünf Besichtigungsterminen gehen an Interessenten ohne Finanzierungsbestätigung oder echte Kaufabsicht. Das sind Fahrtzeit, Schlüsselübergaben und Samstagsstunden für Kontakte, die nie kaufen.',
            ar: 'ثلاثة من كل خمسة مواعيد معاينة تذهب لمهتمين بلا تأكيد تمويل أو نية شراء حقيقية. وذلك وقت تنقّل وتسليم مفاتيح وساعات سبت تُنفق على من لن يشتري.',
          },
        },
      ],
    },

    math: {
      label: { en: 'The maths', de: 'Die Rechnung', ar: 'الحساب' },
      h2: {
        en: 'What late replies<br/><em>cost an agency.</em>',
        de: 'Was späte Antworten<br/><em>ein Maklerbüro kosten.</em>',
        ar: 'ما تكلفة الردود المتأخرة<br/><em>على مكتب عقاري.</em>',
      },
      sub: {
        en: 'A mid-sized agency, calculated with conservative assumptions. Run your own numbers with us in the intro call.',
        de: 'Ein mittelgroßes Maklerbüro, konservativ gerechnet. Ihre eigenen Zahlen rechnen wir im Kennenlerngespräch gemeinsam durch.',
        ar: 'مكتب عقاري متوسط الحجم، بحسابات متحفظة. نحسب أرقامك الخاصة معاً في مكالمة التعارف.',
      },
      tag: { en: 'Real estate brokerage', de: 'Immobilienmakler', ar: 'وساطة عقارية' },
      setup: {
        en: '200 enquiries a month from portals, the website and WhatsApp.',
        de: '200 Anfragen pro Monat über Portale, Website und WhatsApp.',
        ar: '200 استفسار شهرياً من المنصات والموقع وواتساب.',
      },
      rows: [
        {
          k: { en: 'Answered too late', de: 'Zu spät beantwortet', ar: 'تمت الإجابة متأخراً' },
          v: { en: '70 a month', de: '70 pro Monat', ar: '70 شهرياً' },
        },
        {
          k: { en: 'Avg. value per deal', de: 'Ø Wert pro Abschluss', ar: 'متوسط قيمة الصفقة' },
          v: { en: '€6,000 commission', de: '6.000 € Provision', ar: '6,000 يورو عمولة' },
        },
        {
          k: { en: 'Lost per month', de: 'Verlust pro Monat', ar: 'الخسارة شهرياً' },
          v: { en: 'approx. €12,600', de: 'ca. 12.600 €', ar: 'نحو 12,600 يورو' },
        },
      ],
      yearLabel: { en: 'Lost per year (approx.)', de: 'Verlust pro Jahr (ca.)', ar: 'الخسارة سنوياً (تقريباً)' },
      year: { en: '€151,000', de: '151.000 €', ar: '151,000 يورو' },
      howTag: { en: 'How the figure is derived', de: 'Wie die Zahl zustande kommt', ar: 'كيف نصل إلى الرقم' },
      how: {
        en: 'Of 200 monthly enquiries, roughly 70 are answered outside the window in which a prospect is still deciding. At a conservative 3 percent close rate that is 2.1 lost deals a month. At €6,000 average commission this comes to about €12,600 a month, or roughly €151,000 a year.',
        de: 'Von 200 Anfragen im Monat werden rund 70 außerhalb des Zeitfensters beantwortet, in dem sich ein Interessent noch entscheidet. Bei konservativen 3 Prozent Abschlussquote sind das 2,1 verlorene Abschlüsse pro Monat. Bei 6.000 € Durchschnittsprovision ergibt das etwa 12.600 € im Monat oder rund 151.000 € im Jahr.',
        ar: 'من بين 200 استفسار شهرياً، يُجاب نحو 70 خارج النافذة الزمنية التي لا يزال المهتم يقرر خلالها. وبنسبة إغلاق متحفظة قدرها 3 بالمئة، فتلك 2.1 صفقة ضائعة شهرياً. وبمتوسط عمولة 6,000 يورو يبلغ ذلك نحو 12,600 يورو شهرياً، أي قرابة 151,000 يورو سنوياً.',
      },
      withLabel: { en: 'With HYBOTE:', de: 'Mit HYBOTE:', ar: 'مع HYBOTE:' },
      with: {
        en: 'Every enquiry is answered and qualified immediately, evenings and weekends included.',
        de: 'Jede Anfrage wird sofort beantwortet und qualifiziert, abends und am Wochenende inklusive.',
        ar: 'يُجاب على كل استفسار ويُؤهَّل فوراً، مساءً وفي عطلات نهاية الأسبوع أيضاً.',
      },
      disclaimer: {
        en: 'Illustrative example calculation based on typical industry figures. No guarantee of actual results.',
        de: 'Illustrative Beispielrechnung auf Basis typischer Branchenwerte. Keine Garantie für tatsächliche Ergebnisse.',
        ar: 'حساب توضيحي مبني على أرقام نموذجية في القطاع. لا ضمان للنتائج الفعلية.',
      },
    },

    caps: {
      label: { en: 'In practice', de: 'In der Praxis', ar: 'على أرض الواقع' },
      h2: {
        en: 'What HYBOTE handles<br/><em>for an agency.</em>',
        de: 'Was HYBOTE<br/><em>für ein Maklerbüro übernimmt.</em>',
        ar: 'ما يتولاه HYBOTE<br/><em>لمكتب عقاري.</em>',
      },
      sub: {
        en: 'Built around how an agency actually works, not a generic chatbot dropped onto your website.',
        de: 'Gebaut entlang der tatsächlichen Abläufe eines Maklerbüros, kein generischer Chatbot auf der Website.',
        ar: 'مبني وفق سير العمل الفعلي لمكتب عقاري، لا مجرد روبوت محادثة عام على الموقع.',
      },
      items: [
        {
          t: { en: 'Instant reply on every channel', de: 'Sofortantwort auf jedem Kanal', ar: 'رد فوري على كل قناة' },
          d: {
            en: 'Portal enquiries, contact form, WhatsApp, email and phone. The prospect gets a personal, on brand reply within seconds, in their own language.',
            de: 'Portalanfragen, Kontaktformular, WhatsApp, E-Mail und Telefon. Der Interessent erhält binnen Sekunden eine persönliche Antwort in Ihrer Tonalität und in seiner Sprache.',
            ar: 'استفسارات المنصات ونموذج التواصل وواتساب والبريد والهاتف. يتلقى المهتم خلال ثوانٍ رداً شخصياً بنبرة علامتك وبلغته.',
          },
        },
        {
          t: { en: 'Answers about the listing', de: 'Antworten zum Objekt', ar: 'إجابات عن العقار' },
          d: {
            en: 'Service charge, year built, energy rating, floor plan, commission, availability. HYBOTE draws on your listing data and answers precisely, without your team retyping it.',
            de: 'Hausgeld, Baujahr, Energiekennwert, Grundriss, Provision, Verfügbarkeit. HYBOTE greift auf Ihre Objektdaten zu und antwortet präzise, ohne dass Ihr Team es erneut tippt.',
            ar: 'رسوم الخدمة وسنة البناء وكفاءة الطاقة والمخطط والعمولة والتوفر. يعتمد HYBOTE على بيانات عقاراتك ويجيب بدقة دون إعادة كتابة من فريقك.',
          },
        },
        {
          t: { en: 'Qualification before the viewing', de: 'Qualifizierung vor der Besichtigung', ar: 'التأهيل قبل المعاينة' },
          d: {
            en: 'Financing status, timeframe, equity, intended use. Only prospects who genuinely fit the property reach your calendar.',
            de: 'Finanzierungsstand, Zeithorizont, Eigenkapital, geplante Nutzung. In Ihren Kalender kommt nur, wer wirklich zum Objekt passt.',
            ar: 'حالة التمويل والإطار الزمني ورأس المال والاستخدام المقصود. لا يصل إلى تقويمك إلا من يناسب العقار فعلاً.',
          },
        },
        {
          t: { en: 'Viewing appointments booked directly', de: 'Besichtigungstermine direkt gebucht', ar: 'حجز مواعيد المعاينة مباشرة' },
          d: {
            en: 'Free slots, travel time between properties and the responsible agent are taken into account. The appointment lands in the right calendar, with a reminder before it.',
            de: 'Freie Slots, Fahrzeiten zwischen Objekten und der zuständige Berater werden berücksichtigt. Der Termin landet im richtigen Kalender, inklusive Erinnerung vorab.',
            ar: 'تُراعى الأوقات المتاحة وزمن التنقل بين العقارات والمستشار المسؤول. يصل الموعد إلى التقويم الصحيح مع تذكير مسبق.',
          },
        },
        {
          t: { en: 'Everything in your CRM', de: 'Alles im CRM', ar: 'كل شيء في نظام إدارة العملاء' },
          d: {
            en: 'Contact, property reference, qualification and full conversation history are synced into the system you already use. Nothing lives in a separate tool.',
            de: 'Kontakt, Objektreferenz, Qualifizierung und der komplette Gesprächsverlauf werden in Ihr bestehendes System übertragen. Nichts liegt in einem separaten Tool.',
            ar: 'تُزامَن جهة الاتصال ومرجع العقار والتأهيل وسجل المحادثة كاملاً مع نظامك الحالي. لا شيء يبقى في أداة منفصلة.',
          },
        },
        {
          t: { en: 'Follow up that does not slip', de: 'Nachfassen, das nicht liegen bleibt', ar: 'متابعة لا تُنسى' },
          d: {
            en: 'After a viewing, and for prospects who are not ready yet. HYBOTE checks back at the right moment instead of letting the contact go cold in a list.',
            de: 'Nach der Besichtigung und bei Interessenten, die noch nicht so weit sind. HYBOTE meldet sich zum richtigen Zeitpunkt, statt den Kontakt in einer Liste kalt werden zu lassen.',
            ar: 'بعد المعاينة ومع المهتمين الذين لم يجهزوا بعد. يتواصل HYBOTE في الوقت المناسب بدل ترك جهة الاتصال تبرد داخل قائمة.',
          },
        },
      ],
    },

    process: {
      label: { en: 'Our approach', de: 'Unser Vorgehen', ar: 'منهجنا' },
      h2: { en: 'How we work.', de: 'Wie wir arbeiten.', ar: 'كيف نعمل.' },
      steps: [
        {
          t: { en: 'Analysis', de: 'Analyse', ar: 'التحليل' },
          d: {
            en: 'We look at where your enquiries come from, how quickly they are answered today and which listings generate the most contact.',
            de: 'Wir sehen uns an, woher Ihre Anfragen kommen, wie schnell sie heute beantwortet werden und welche Objekte den meisten Kontakt erzeugen.',
            ar: 'ننظر في مصادر استفساراتك وسرعة الرد عليها اليوم والعقارات التي تولّد أكبر قدر من التواصل.',
          },
        },
        {
          t: { en: 'Design', de: 'Konzeption', ar: 'التصميم' },
          d: {
            en: 'We define the conversation flow, the qualification criteria and the point at which a human colleague takes over.',
            de: 'Wir legen den Gesprächsverlauf fest, die Qualifizierungskriterien und den Punkt, an dem ein Mensch übernimmt.',
            ar: 'نحدد مسار المحادثة ومعايير التأهيل والنقطة التي يتولى عندها زميل بشري.',
          },
        },
        {
          t: { en: 'Build', de: 'Umsetzung', ar: 'التنفيذ' },
          d: {
            en: 'We build the assistant on your listing data, in your tone of voice, in the languages your clients speak.',
            de: 'Wir bauen den Assistenten auf Ihren Objektdaten auf, in Ihrer Tonalität und in den Sprachen Ihrer Kunden.',
            ar: 'نبني المساعد اعتماداً على بيانات عقاراتك وبنبرة علامتك وباللغات التي يتحدثها عملاؤك.',
          },
        },
        {
          t: { en: 'Integration', de: 'Integration', ar: 'التكامل' },
          d: {
            en: 'Portals, CRM and calendar are connected. From day one every enquiry lands where your team already works.',
            de: 'Portale, CRM und Kalender werden angebunden. Ab dem ersten Tag landet jede Anfrage dort, wo Ihr Team ohnehin arbeitet.',
            ar: 'تُربط المنصات ونظام إدارة العملاء والتقويم. ومن اليوم الأول يصل كل استفسار حيث يعمل فريقك أصلاً.',
          },
        },
      ],
    },

    faq: {
      label: { en: 'FAQ', de: 'FAQ', ar: 'الأسئلة الشائعة' },
      h2: {
        en: 'Questions from<br/>agency owners.',
        de: 'Fragen von<br/>Maklerinnen und Maklern.',
        ar: 'أسئلة من<br/>أصحاب المكاتب العقارية.',
      },
      items: [
        {
          q: {
            en: 'Will prospects notice they are talking to an assistant?',
            de: 'Merken Interessenten, dass sie mit einem Assistenten schreiben?',
            ar: 'هل يلاحظ المهتمون أنهم يتحدثون إلى مساعد آلي؟',
          },
          a: {
            en: 'We do not pretend otherwise. HYBOTE identifies itself as your digital assistant and hands over to a colleague as soon as the conversation calls for it. In practice prospects care about one thing: getting a fast, competent answer.',
            de: 'Wir tun nicht so, als wäre es anders. HYBOTE weist sich als Ihr digitaler Assistent aus und übergibt an einen Kollegen, sobald das Gespräch es erfordert. In der Praxis zählt für Interessenten vor allem eines: eine schnelle, kompetente Antwort.',
            ar: 'لا ندّعي غير ذلك. يعرّف HYBOTE عن نفسه كمساعدك الرقمي ويحوّل المحادثة إلى زميل بمجرد أن تستدعي ذلك. وعملياً يهتم المهتمون بأمر واحد: رد سريع وكفء.',
          },
        },
        {
          q: {
            en: 'Does it work with the portals we already use?',
            de: 'Funktioniert das mit unseren bestehenden Portalen?',
            ar: 'هل يعمل مع المنصات التي نستخدمها؟',
          },
          a: {
            en: 'Yes. Enquiries reach you by email or through your CRM regardless of the portal, and that is exactly where HYBOTE picks them up. There is no need to change how your listings are published.',
            de: 'Ja. Anfragen erreichen Sie unabhängig vom Portal per E-Mail oder über Ihr CRM, und genau dort greift HYBOTE sie ab. An der Art, wie Sie Ihre Objekte veröffentlichen, ändert sich nichts.',
            ar: 'نعم. تصلك الاستفسارات عبر البريد الإلكتروني أو نظام إدارة العملاء بغض النظر عن المنصة، وهناك تحديداً يلتقطها HYBOTE. ولا حاجة لتغيير طريقة نشر عقاراتك.',
          },
        },
        {
          q: {
            en: 'Who keeps control over the viewing calendar?',
            de: 'Wer behält die Kontrolle über den Besichtigungskalender?',
            ar: 'من يحتفظ بالتحكم في تقويم المعاينات؟',
          },
          a: {
            en: 'You do. You define which slots are bookable, how much travel time sits between properties and which criteria a prospect must meet before an appointment is offered at all.',
            de: 'Sie. Sie legen fest, welche Slots buchbar sind, wie viel Fahrzeit zwischen Objekten liegt und welche Kriterien ein Interessent erfüllen muss, bevor überhaupt ein Termin angeboten wird.',
            ar: 'أنت. تحدد الأوقات القابلة للحجز ومقدار زمن التنقل بين العقارات والمعايير التي يجب أن يستوفيها المهتم قبل عرض أي موعد.',
          },
        },
        {
          q: {
            en: 'What happens with data protection and prospect data?',
            de: 'Wie ist das mit Datenschutz und Interessentendaten?',
            ar: 'ماذا عن حماية البيانات وبيانات المهتمين؟',
          },
          a: {
            en: 'Your data stays yours. We work on a data minimisation principle, GDPR compliant, with strict separation between clients. Prospect data is not used to train anything and is not passed on.',
            de: 'Ihre Daten bleiben Ihre Daten. Wir arbeiten nach dem Prinzip der Datensparsamkeit, DSGVO-konform und mit strikter Trennung zwischen Mandanten. Interessentendaten werden nicht zum Training verwendet und nicht weitergegeben.',
            ar: 'بياناتك تبقى ملكك. نعمل بمبدأ تقليل البيانات، بما يتوافق مع اللائحة الأوروبية، مع فصل صارم بين العملاء. ولا تُستخدم بيانات المهتمين للتدريب ولا تُشارَك.',
          },
        },
        {
          q: {
            en: 'How long until it is live?',
            de: 'Wie lange dauert es bis zum Livegang?',
            ar: 'كم يستغرق الأمر حتى يبدأ العمل؟',
          },
          a: {
            en: 'First automations typically go live within a few days. We set the exact timeline once the analysis is done, because it depends on how many systems need connecting.',
            de: 'Erste Automatisierungen gehen meist innerhalb weniger Tage live. Den genauen Zeitplan legen wir nach der Analyse fest, denn er hängt davon ab, wie viele Systeme angebunden werden.',
            ar: 'تبدأ الأتمتة الأولى بالعمل عادة خلال أيام قليلة. ونحدد الجدول الزمني الدقيق بعد التحليل، لأنه يعتمد على عدد الأنظمة المطلوب ربطها.',
          },
        },
        {
          q: {
            en: 'We are a team of three. Is that too small?',
            de: 'Wir sind ein Team von drei Personen. Ist das zu klein?',
            ar: 'نحن فريق من ثلاثة أشخاص. هل هذا صغير جداً؟',
          },
          a: {
            en: 'No. Small teams often gain the most, because there is nobody who can answer enquiries in the evening. The scope of the setup follows the size of the agency, and so does the price.',
            de: 'Nein. Kleine Teams profitieren oft am meisten, weil niemand da ist, der abends Anfragen beantwortet. Der Umfang des Setups richtet sich nach der Größe des Büros, und der Preis ebenso.',
            ar: 'لا. غالباً ما تستفيد الفرق الصغيرة أكثر، لعدم وجود من يرد على الاستفسارات مساءً. ويتناسب نطاق الإعداد مع حجم المكتب، وكذلك السعر.',
          },
        },
      ],
    },

    cross: {
      label: { en: 'Also built for', de: 'Ebenfalls im Einsatz für', ar: 'مصمم أيضاً لـ' },
      car_dealerships: { en: 'Car dealerships', de: 'Autohäuser', ar: 'وكالات السيارات' },
      medical_practices: { en: 'Practices & clinics', de: 'Praxen & Kliniken', ar: 'العيادات والمراكز الطبية' },
    },
  },
};
