// Landingpage: Praxis & Klinik.
// Zahlen aus dem bestehenden Case ex.c3.* in index.html.
// Tonalität hier bewusst zurückhaltender: keine Heilsversprechen, klare Grenze
// bei medizinischer Beratung und Notfällen.

export default {
  slug: 'medical-practices',

  meta: {
    title: {
      en: 'AI Reception for Medical Practices | No Missed Calls | HYBOTE',
      de: 'KI-Empfang für Praxen & Kliniken | Kein verpasster Anruf | HYBOTE',
      ar: 'استقبال آلي للعيادات والمراكز الطبية | لا مكالمة تفوتك | HYBOTE',
    },
    desc: {
      en: 'The phone rings while reception is with a patient. HYBOTE answers every call around the clock, books appointments, handles routine questions and escalates urgent cases to your team. Book a free intro call.',
      de: 'Das Telefon klingelt, während der Empfang beim Patienten ist. HYBOTE nimmt jeden Anruf rund um die Uhr an, vergibt Termine, klärt Routinefragen und leitet dringende Fälle an Ihr Team weiter. Kostenloses Kennenlerngespräch buchen.',
      ar: 'يرن الهاتف بينما الاستقبال مشغول مع مريض. يرد HYBOTE على كل مكالمة على مدار الساعة ويحجز المواعيد ويعالج الأسئلة الروتينية ويحوّل الحالات العاجلة إلى فريقك. احجز مكالمة تعارف مجانية.',
    },
    keywords: 'AI receptionist medical practice, appointment booking automation clinic, missed calls dental practice, patient enquiry AI, practice phone automation, KI Telefon Praxis',
    lead: { en: 'Practices & clinics', de: 'Praxen & Kliniken', ar: 'العيادات والمراكز الطبية' },
    serviceName: {
      en: 'AI call handling and appointment booking for medical practices',
      de: 'KI-Telefonannahme und Terminvergabe für Praxen und Kliniken',
      ar: 'الرد الآلي على المكالمات وحجز المواعيد للعيادات',
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
        en: 'FOR PRACTICES & CLINICS · AI AUTOMATION',
        de: 'FÜR PRAXEN & KLINIKEN · KI-AUTOMATISIERUNG',
        ar: 'للعيادات والمراكز الطبية · أتمتة الذكاء الاصطناعي',
      },
      h1: {
        en: 'The phone stops ringing<br/><span class="grad-text" style="font-style:italic;">into an empty room.</span>',
        de: 'Das Telefon klingelt nicht mehr<br/><span class="grad-text" style="font-style:italic;">ins Leere.</span>',
        ar: 'لم يعد الهاتف يرن<br/><span class="grad-text" style="font-style:italic;">دون مجيب.</span>',
      },
      sub: {
        en: 'Reception cannot be on the phone and with a patient at the same time. HYBOTE takes every call, books appointments and answers routine questions, <strong style="font-weight:400;color:var(--fg);">while your team stays with the people in front of them.</strong>',
        de: 'Der Empfang kann nicht gleichzeitig am Telefon und beim Patienten sein. HYBOTE nimmt jeden Anruf an, vergibt Termine und klärt Routinefragen, <strong style="font-weight:400;color:var(--fg);">während Ihr Team bei den Menschen vor Ort bleibt.</strong>',
        ar: 'لا يمكن للاستقبال أن يكون على الهاتف ومع المريض في آن واحد. يتلقى HYBOTE كل مكالمة ويحجز المواعيد ويجيب عن الأسئلة الروتينية، <strong style="font-weight:400;color:var(--fg);">بينما يبقى فريقك مع من أمامه.</strong>',
      },
      cta1: { en: 'Free intro call', de: 'Kostenloses Kennenlerngespräch', ar: 'مكالمة تعارف مجانية' },
      cta2: { en: 'See the numbers', de: 'Zahlen ansehen', ar: 'اطّلع على الأرقام' },
    },

    problem: {
      label: { en: 'The situation', de: 'Die Ausgangslage', ar: 'الوضع الحالي' },
      h2: {
        en: 'Reception is with a patient.<br/><em>The phone rings anyway.</em>',
        de: 'Der Empfang ist beim Patienten.<br/><em>Das Telefon klingelt trotzdem.</em>',
        ar: 'الاستقبال مع مريض.<br/><em>والهاتف يرن رغم ذلك.</em>',
      },
      sub: {
        en: 'Every unanswered call is a patient who calls the next practice on the list. Most of them do not call back.',
        de: 'Jeder nicht angenommene Anruf ist ein Patient, der die nächste Praxis auf der Liste anruft. Die wenigsten rufen noch einmal zurück.',
        ar: 'كل مكالمة دون رد هي مريض يتصل بالعيادة التالية في القائمة. وقليل منهم يعاود الاتصال.',
      },
      items: [
        {
          t: { en: 'The morning peak', de: 'Die Morgenspitze', ar: 'ذروة الصباح' },
          d: {
            en: 'Between 08:00 and 10:00 the phone rings far more often than one person can answer. Callers hear an engaged tone, hang up and try elsewhere.',
            de: 'Zwischen 8 und 10 Uhr klingelt das Telefon deutlich häufiger, als eine Person annehmen kann. Anrufer hören besetzt, legen auf und versuchen es woanders.',
            ar: 'بين الثامنة والعاشرة صباحاً يرن الهاتف أكثر مما يستطيع شخص واحد الرد عليه. يسمع المتصلون نغمة الانشغال فيغلقون ويجربون مكاناً آخر.',
          },
        },
        {
          t: { en: 'Routine questions block the line', de: 'Routinefragen blockieren die Leitung', ar: 'الأسئلة الروتينية تشغل الخط' },
          d: {
            en: 'Opening hours, what to bring, is the referral still needed, has the result arrived. Necessary questions, but they occupy the line that an urgent case needs.',
            de: 'Öffnungszeiten, was mitzubringen ist, wird die Überweisung noch gebraucht, ist der Befund da. Notwendige Fragen, aber sie belegen die Leitung, die ein dringender Fall braucht.',
            ar: 'ساعات العمل، وما يجب إحضاره، وهل ما زالت الإحالة مطلوبة، وهل وصلت النتيجة. أسئلة ضرورية، لكنها تشغل الخط الذي تحتاجه حالة عاجلة.',
          },
        },
        {
          t: { en: 'Appointments that nobody attends', de: 'Termine, zu denen niemand kommt', ar: 'مواعيد لا يحضرها أحد' },
          d: {
            en: 'An appointment booked weeks ago without a reminder is frequently missed. The slot stays empty while someone else waited for it.',
            de: 'Ein Termin, der vor Wochen ohne Erinnerung vereinbart wurde, platzt häufig. Der Slot bleibt leer, obwohl jemand anderes darauf gewartet hat.',
            ar: 'الموعد المحجوز قبل أسابيع دون تذكير كثيراً ما يُفوَّت. فيبقى الوقت شاغراً بينما كان غيره ينتظره.',
          },
        },
      ],
    },

    math: {
      label: { en: 'The maths', de: 'Die Rechnung', ar: 'الحساب' },
      h2: {
        en: 'What unanswered calls<br/><em>cost a practice.</em>',
        de: 'Was nicht angenommene Anrufe<br/><em>eine Praxis kosten.</em>',
        ar: 'ما تكلفة المكالمات دون رد<br/><em>على العيادة.</em>',
      },
      sub: {
        en: 'A practice with a busy phone, calculated with conservative assumptions. Run your own numbers with us in the intro call.',
        de: 'Eine Praxis mit hohem Telefonaufkommen, konservativ gerechnet. Ihre eigenen Zahlen rechnen wir im Kennenlerngespräch gemeinsam durch.',
        ar: 'عيادة بحركة هاتفية عالية، بحسابات متحفظة. نحسب أرقامك الخاصة معاً في مكالمة التعارف.',
      },
      tag: { en: 'Practice & clinic', de: 'Praxis & Klinik', ar: 'عيادة ومركز طبي' },
      setup: {
        en: '600 calls a month, with reception tied up in day-to-day work.',
        de: '600 Anrufe pro Monat, bei einem Empfang, der im Tagesgeschäft gebunden ist.',
        ar: '600 مكالمة شهرياً، مع استقبال مشغول بالعمل اليومي.',
      },
      rows: [
        {
          k: { en: 'Calls not answered', de: 'Nicht angenommene Anrufe', ar: 'مكالمات دون رد' },
          v: { en: '150 a month', de: '150 pro Monat', ar: '150 شهرياً' },
        },
        {
          k: { en: 'Avg. value per visit', de: 'Ø Wert pro Behandlung', ar: 'متوسط قيمة الزيارة' },
          v: { en: '€180 per treatment', de: '180 € pro Behandlung', ar: '180 يورو للعلاج' },
        },
        {
          k: { en: 'Lost per month', de: 'Verlust pro Monat', ar: 'الخسارة شهرياً' },
          v: { en: 'approx. €10,800', de: 'ca. 10.800 €', ar: 'نحو 10,800 يورو' },
        },
      ],
      yearLabel: { en: 'Lost per year (approx.)', de: 'Verlust pro Jahr (ca.)', ar: 'الخسارة سنوياً (تقريباً)' },
      year: { en: '€130,000', de: '130.000 €', ar: '130,000 يورو' },
      howTag: { en: 'How the figure is derived', de: 'Wie die Zahl zustande kommt', ar: 'كيف نصل إلى الرقم' },
      how: {
        en: 'Of 600 monthly calls, roughly 150 go unanswered. If 40 percent of those would have become an appointment, that is 60 treatments a month. At €180 average value this comes to about €10,800 a month, or roughly €130,000 a year.',
        de: 'Von 600 Anrufen im Monat bleiben rund 150 unbeantwortet. Wären davon 40 Prozent zu einem Termin geworden, sind das 60 Behandlungen im Monat. Bei 180 € Durchschnittswert ergibt das etwa 10.800 € im Monat oder rund 130.000 € im Jahr.',
        ar: 'من بين 600 مكالمة شهرياً، تبقى نحو 150 دون رد. ولو تحوّل 40 بالمئة منها إلى مواعيد، فتلك 60 حالة علاج شهرياً. وبمتوسط قيمة 180 يورو يبلغ ذلك نحو 10,800 يورو شهرياً، أي قرابة 130,000 يورو سنوياً.',
      },
      withLabel: { en: 'With HYBOTE:', de: 'Mit HYBOTE:', ar: 'مع HYBOTE:' },
      with: {
        en: 'Calls are answered around the clock, appointments are booked automatically and routine questions get answered.',
        de: 'Anrufe werden rund um die Uhr angenommen, Termine automatisch vergeben und Routinefragen beantwortet.',
        ar: 'يُرَد على المكالمات على مدار الساعة، وتُحجَز المواعيد آلياً، ويُجاب عن الأسئلة الروتينية.',
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
        en: 'What HYBOTE handles<br/><em>at the front desk.</em>',
        de: 'Was HYBOTE<br/><em>am Empfang übernimmt.</em>',
        ar: 'ما يتولاه HYBOTE<br/><em>عند مكتب الاستقبال.</em>',
      },
      sub: {
        en: 'Administrative relief, with a clear boundary: HYBOTE organises, it does not advise medically.',
        de: 'Entlastung in der Verwaltung, mit einer klaren Grenze: HYBOTE organisiert, es berät nicht medizinisch.',
        ar: 'تخفيف للعبء الإداري، بحدّ واضح: ينظّم HYBOTE ولا يقدّم استشارة طبية.',
      },
      items: [
        {
          t: { en: 'Every call answered', de: 'Jeder Anruf angenommen', ar: 'الرد على كل مكالمة' },
          d: {
            en: 'No engaged tone, no queue. Calls are taken during the morning peak, at lunchtime, in the evening and at weekends, in the patient’s language.',
            de: 'Kein Besetztzeichen, keine Warteschleife. Anrufe werden in der Morgenspitze, mittags, abends und am Wochenende angenommen, in der Sprache des Patienten.',
            ar: 'لا نغمة انشغال ولا انتظار. تُستقبل المكالمات في ذروة الصباح والظهيرة والمساء وعطلات نهاية الأسبوع، بلغة المريض.',
          },
        },
        {
          t: { en: 'Appointments booked and rescheduled', de: 'Termine vergeben und verschoben', ar: 'حجز المواعيد وتعديلها' },
          d: {
            en: 'Working directly against your practice calendar, respecting appointment types, durations and which practitioner is responsible. Cancellations free the slot again immediately.',
            de: 'Direkt im Praxiskalender, unter Berücksichtigung von Terminarten, Dauer und zuständiger Behandlerin oder Behandler. Absagen geben den Slot sofort wieder frei.',
            ar: 'مباشرة في تقويم العيادة، مع مراعاة أنواع المواعيد ومددها والطبيب المسؤول. وتُتيح الإلغاءات الوقت فوراً من جديد.',
          },
        },
        {
          t: { en: 'Reminders that reduce no shows', de: 'Erinnerungen gegen geplatzte Termine', ar: 'تذكيرات تقلّل عدم الحضور' },
          d: {
            en: 'An automatic reminder before the appointment, with the option to cancel or move it in one message. Freed slots can be offered to someone on the waiting list.',
            de: 'Eine automatische Erinnerung vor dem Termin, mit der Möglichkeit, in einer Nachricht abzusagen oder zu verschieben. Frei gewordene Slots lassen sich an die Warteliste vergeben.',
            ar: 'تذكير تلقائي قبل الموعد مع إمكانية الإلغاء أو التعديل برسالة واحدة. ويمكن عرض الأوقات الشاغرة على قائمة الانتظار.',
          },
        },
        {
          t: { en: 'Routine questions off the line', de: 'Routinefragen von der Leitung', ar: 'أسئلة روتينية خارج الخط' },
          d: {
            en: 'Opening hours, directions, what to bring, insurance and referral questions, repeat prescription requests. Answered from your own information, not invented.',
            de: 'Öffnungszeiten, Anfahrt, was mitzubringen ist, Fragen zu Versicherung und Überweisung, Rezeptwünsche. Beantwortet aus Ihren eigenen Informationen, nicht erfunden.',
            ar: 'ساعات العمل والوصول وما يجب إحضاره وأسئلة التأمين والإحالة وطلبات تكرار الوصفات. تُستقى الإجابات من معلوماتك أنت، لا من تخمين.',
          },
        },
        {
          t: { en: 'Clear escalation for urgent cases', de: 'Klare Eskalation bei dringenden Fällen', ar: 'تصعيد واضح للحالات العاجلة' },
          d: {
            en: 'HYBOTE gives no medical advice. Anything that sounds urgent is passed to your team immediately or directed to the emergency number, following rules you define with us.',
            de: 'HYBOTE gibt keine medizinischen Auskünfte. Alles, was dringend klingt, geht sofort an Ihr Team oder wird an die Notfallnummer verwiesen, nach Regeln, die Sie mit uns festlegen.',
            ar: 'لا يقدم HYBOTE أي مشورة طبية. وكل ما يبدو عاجلاً يُحوَّل فوراً إلى فريقك أو يُوجَّه إلى رقم الطوارئ، وفق قواعد تضعونها معنا.',
          },
        },
        {
          t: { en: 'Documented for the team', de: 'Dokumentiert für das Team', ar: 'موثّق للفريق' },
          d: {
            en: 'Every call leaves a short, readable note: who called, what for, what was arranged. Your team starts the day with an overview instead of a stack of callback slips.',
            de: 'Jeder Anruf hinterlässt eine kurze, lesbare Notiz: wer angerufen hat, worum es ging, was vereinbart wurde. Ihr Team startet mit einer Übersicht statt mit einem Stapel Rückrufzettel.',
            ar: 'تترك كل مكالمة ملاحظة قصيرة وواضحة: من اتصل ولماذا وما تم الاتفاق عليه. فيبدأ فريقك يومه بنظرة شاملة بدل كومة من أوراق معاودة الاتصال.',
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
            en: 'We look at your call volume, when the peaks occur, which enquiries recur and how many calls currently go unanswered.',
            de: 'Wir sehen uns Ihr Anrufaufkommen an, wann die Spitzen liegen, welche Anliegen sich wiederholen und wie viele Anrufe heute unbeantwortet bleiben.',
            ar: 'ننظر في حجم مكالماتك وأوقات الذروة والطلبات المتكررة وعدد المكالمات التي تبقى اليوم دون رد.',
          },
        },
        {
          t: { en: 'Design', de: 'Konzeption', ar: 'التصميم' },
          d: {
            en: 'We define together what HYBOTE may handle, what it must never say and exactly when a call is escalated to your team.',
            de: 'Wir legen gemeinsam fest, was HYBOTE übernehmen darf, was es niemals sagen darf und wann genau ein Anruf an Ihr Team eskaliert wird.',
            ar: 'نحدد معاً ما يجوز لـ HYBOTE توليه وما لا يجوز قوله أبداً ومتى تحديداً تُصعَّد المكالمة إلى فريقك.',
          },
        },
        {
          t: { en: 'Build', de: 'Umsetzung', ar: 'التنفيذ' },
          d: {
            en: 'We build the assistant on your practice information, in a calm and professional tone, in the languages your patients speak.',
            de: 'Wir bauen den Assistenten auf Ihren Praxisinformationen auf, in ruhigem, professionellem Ton und in den Sprachen Ihrer Patienten.',
            ar: 'نبني المساعد اعتماداً على معلومات عيادتك، بنبرة هادئة ومهنية، وباللغات التي يتحدثها مرضاك.',
          },
        },
        {
          t: { en: 'Integration', de: 'Integration', ar: 'التكامل' },
          d: {
            en: 'Practice calendar and phone system are connected, so appointments and messages appear where your team already works.',
            de: 'Praxiskalender und Telefonanlage werden angebunden, damit Termine und Nachrichten dort erscheinen, wo Ihr Team ohnehin arbeitet.',
            ar: 'يُربط تقويم العيادة ونظام الهاتف لتظهر المواعيد والرسائل حيث يعمل فريقك أصلاً.',
          },
        },
      ],
    },

    faq: {
      label: { en: 'FAQ', de: 'FAQ', ar: 'الأسئلة الشائعة' },
      h2: {
        en: 'Questions from<br/>practice teams.',
        de: 'Fragen aus<br/>Praxisteams.',
        ar: 'أسئلة من<br/>فرق العيادات.',
      },
      items: [
        {
          q: {
            en: 'Does HYBOTE give medical advice?',
            de: 'Gibt HYBOTE medizinische Auskünfte?',
            ar: 'هل يقدم HYBOTE مشورة طبية؟',
          },
          a: {
            en: 'No, and that boundary is built in deliberately. HYBOTE organises appointments and answers administrative questions. Anything clinical goes to your team. We define the exact wording and the escalation rules with you before it goes live.',
            de: 'Nein, und diese Grenze ist bewusst eingebaut. HYBOTE organisiert Termine und beantwortet administrative Fragen. Alles Medizinische geht an Ihr Team. Die genauen Formulierungen und Eskalationsregeln legen wir vor dem Livegang gemeinsam fest.',
            ar: 'لا، وهذا الحد مُدمج عن قصد. ينظّم HYBOTE المواعيد ويجيب عن الأسئلة الإدارية. وكل ما هو سريري يُحوَّل إلى فريقك. ونحدد معكم الصياغات الدقيقة وقواعد التصعيد قبل بدء التشغيل.',
          },
        },
        {
          q: {
            en: 'What happens in an emergency?',
            de: 'Was passiert im Notfall?',
            ar: 'ماذا يحدث في حالة الطوارئ؟',
          },
          a: {
            en: 'Urgent cases are recognised and handled first. Depending on the rules you set, the call is put through to your team immediately or the caller is directed to the emergency number without delay. HYBOTE never keeps an urgent caller waiting in a booking flow.',
            de: 'Dringende Fälle werden erkannt und zuerst behandelt. Je nach Ihren Regeln wird der Anruf sofort an Ihr Team durchgestellt oder unverzüglich an die Notfallnummer verwiesen. HYBOTE hält einen dringenden Anrufer niemals in einer Terminstrecke fest.',
            ar: 'تُميَّز الحالات العاجلة وتُعالَج أولاً. وبحسب القواعد التي تضعونها، تُحوَّل المكالمة فوراً إلى فريقك أو يُوجَّه المتصل دون تأخير إلى رقم الطوارئ. ولا يُبقي HYBOTE متصلاً عاجلاً داخل مسار حجز أبداً.',
          },
        },
        {
          q: {
            en: 'Is this compatible with medical confidentiality?',
            de: 'Ist das mit der ärztlichen Schweigepflicht vereinbar?',
            ar: 'هل يتوافق ذلك مع السرية الطبية؟',
          },
          a: {
            en: 'We work under strict data isolation: no data is shared between clients, all communication is encrypted and nothing is used to train anything. Which data is processed at all is agreed with you and kept to the minimum needed for scheduling. Please have your data protection officer review the setup before it goes live, as you would with any new system.',
            de: 'Wir arbeiten mit strikter Datenisolation: keine Datenweitergabe zwischen Mandanten, verschlüsselte Kommunikation und keine Verwendung zu Trainingszwecken. Welche Daten überhaupt verarbeitet werden, stimmen wir mit Ihnen ab und beschränken es auf das für die Terminvergabe Nötige. Lassen Sie das Setup bitte wie bei jedem neuen System vor dem Livegang von Ihrem Datenschutzbeauftragten prüfen.',
            ar: 'نعمل بعزل صارم للبيانات: لا مشاركة بين العملاء، واتصالات مشفّرة، ولا استخدام لأي تدريب. ونتفق معكم على البيانات التي تُعالَج أصلاً ونقصرها على الحد اللازم لتنظيم المواعيد. ونرجو أن يراجع مسؤول حماية البيانات لديكم الإعداد قبل التشغيل، كما هي الحال مع أي نظام جديد.',
          },
        },
        {
          q: {
            en: 'Does it work with our practice management software?',
            de: 'Funktioniert das mit unserer Praxissoftware?',
            ar: 'هل يعمل مع برنامج إدارة العيادة لدينا؟',
          },
          a: {
            en: 'In most cases yes. Where a direct connection is not possible, HYBOTE works against a separate booking calendar that your team keeps in view. We clarify this in the analysis, before anything is promised.',
            de: 'In den meisten Fällen ja. Wo eine direkte Anbindung nicht möglich ist, arbeitet HYBOTE gegen einen separaten Buchungskalender, den Ihr Team im Blick behält. Das klären wir in der Analyse, bevor etwas zugesagt wird.',
            ar: 'في معظم الحالات نعم. وحيث يتعذّر الربط المباشر، يعمل HYBOTE على تقويم حجز منفصل يبقى تحت نظر فريقك. ونوضّح ذلك في مرحلة التحليل قبل أي وعد.',
          },
        },
        {
          q: {
            en: 'Will patients accept talking to a machine?',
            de: 'Akzeptieren Patienten es, mit einer Maschine zu sprechen?',
            ar: 'هل يتقبّل المرضى التحدث إلى نظام آلي؟',
          },
          a: {
            en: 'Experience suggests most people prefer an immediate, clear answer to an engaged tone. HYBOTE identifies itself openly and hands over to a person whenever the caller asks for one.',
            de: 'Die Erfahrung zeigt, dass die meisten eine sofortige, klare Antwort einem Besetztzeichen vorziehen. HYBOTE weist sich offen aus und übergibt an einen Menschen, sobald der Anrufer das möchte.',
            ar: 'تشير التجربة إلى أن معظم الناس يفضلون رداً فورياً وواضحاً على نغمة انشغال. ويعرّف HYBOTE عن نفسه بوضوح ويحوّل إلى شخص متى طلب المتصل ذلك.',
          },
        },
        {
          q: {
            en: 'How long until it is live?',
            de: 'Wie lange dauert es bis zum Livegang?',
            ar: 'كم يستغرق الأمر حتى يبدأ العمل؟',
          },
          a: {
            en: 'First automations typically go live within a few days. In a practice setting we usually start with appointment booking and routine questions, then extend step by step once the team is comfortable.',
            de: 'Erste Automatisierungen gehen meist innerhalb weniger Tage live. Im Praxisumfeld starten wir in der Regel mit Terminvergabe und Routinefragen und erweitern schrittweise, sobald das Team sich sicher fühlt.',
            ar: 'تبدأ الأتمتة الأولى بالعمل عادة خلال أيام قليلة. وفي بيئة العيادات نبدأ غالباً بحجز المواعيد والأسئلة الروتينية ثم نوسّع تدريجياً متى اطمأن الفريق.',
          },
        },
      ],
    },

    cross: {
      label: { en: 'Also built for', de: 'Ebenfalls im Einsatz für', ar: 'مصمم أيضاً لـ' },
      real_estate: { en: 'Real estate agencies', de: 'Immobilienmakler', ar: 'وكالات العقارات' },
      car_dealerships: { en: 'Car dealerships', de: 'Autohäuser', ar: 'وكالات السيارات' },
    },
  },
};
