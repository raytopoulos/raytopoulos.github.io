const translations = {
  en: {
    languageLabel: 'Language',
    languageName: 'English',
    pageTitleLanding: 'Bubble Organizer — Instances',
    pageTitleEditor: 'Bubble Canvas (Table Layout)',
    appAriaLabel: 'Bubble canvas app',
    pageTitleView: 'Bubble Snapshot Viewer',
    viewTitle: 'Weekly Report',
    viewSubtitlePrefix: 'Read-only table view of saved bubbles. Append',
    viewSubtitleSuffix: 'to the URL to show a specific board. Rows are unique timestamps (earliest -> latest); columns are days.',
    viewStatusWaiting: 'Waiting for an instance id...',
    viewStatusNeedId: 'Add ?id=<instance-id> to the URL to render a saved board.',
    viewStatusLoading: 'Loading...',
    viewStatusNotFound: 'Instance not found or has no data.',
    viewStatusNoBubbles: 'No bubbles found for this instance.',
    viewStatusViewing: 'Viewing instance {{id}}',
    viewStatusError: 'Unable to load data. Check the console for details.',
    viewTableLoading: 'Loading timeline...',
    viewTableNoData: 'No data for this instance.',
    viewTableNoBubbles: 'No bubbles positioned yet.',
    viewTableError: 'Error loading data.',
    viewEmptyPrompt: 'Provide an instance id to load data.',
    viewTimeHeader: 'Time',
    viewBubbleUntitled: 'Untitled bubble',
    viewNoTime: 'No Time',
    viewCellPlaceholder: '—',
    landingTitle: 'Bubble Organizer',
    landingSubtitle: 'Jump into an existing planner by id, or create a new prototype and its first instance.',
    landingInputPlaceholder: 'Paste an instance or prototype id…',
    landingInputLabel: 'Instance or prototype id',
    landingOpen: 'Open',
    landingNew: '+ New planner',
    landingStatusWaiting: 'Waiting for an id. Provide a composite or prototype id, or create a new planner.',
    landingStatusLooking: 'Looking up prototype…',
    landingStatusNoPrototype: 'Error: no prototype found for this id.',
    landingStatusRecreateError: 'Error: could not recreate stored prototype. Please try again.',
    landingStatusProtoEmpty: 'Prototype found, but there are no instances yet. Create a new one below.',
    landingStatusProtoFound: 'Prototype found. Choose an instance to open, or create another.',
    landingStatusLoadError: 'Something went wrong while loading this prototype.',
    landingStatusCreate: 'Creating a new prototype and its first instance…',
    landingStatusCreateFail: 'Could not create a new planner right now. Please try again.',
    instanceLabelTemplate: 'Instance #{{n}}',
    instanceEmpty: 'No instances found for this prototype yet.',
    defaultPrototypeTask: 'Task',
    defaultPrototypeIdea: 'Idea',
    defaultPrototypeBug: 'Bug',
    defaultPrototypeNote: 'Note',
    defaultPrototypeInput: 'Input',
    defaultPrototypeOutput: 'Output',
    sidebarTitle: 'Bubble Library',
    sidebarClose: 'Close library',
    sidebarHint: 'Drag a bubble onto the canvas to create an instance.',
    sidebarAdd: 'Add bubble',
    sidebarAddAria: 'Add bubble',
    toolbarMenu: 'Open menu',
    toolbarTitleDefault: 'Weekly Planner',
    toolbarEdit: 'Edit',
    toolbarDone: 'Done',
    toolbarEditTooltip: 'Edit',
    toolbarNameAria: 'Planner name',
    trashLabel: 'Drop to delete',
    trashAria: 'Delete dropzone',
    modalTitle: 'Create a new bubble',
    modalLabelText: 'Bubble text',
    modalPlaceholderText: 'e.g. Idea, Todo, Person...',
    modalLabelDescription: 'Description',
    modalPlaceholderDescription: 'Optional description',
    modalLabelTime: 'Time (HH:MM:SS)',
    modalPlaceholderTime: 'HH:MM or HH:MM:SS',
    modalTimeHour: 'Hours',
    modalTimeMinute: 'Minutes',
    modalTimeSecond: 'Seconds',
    modalLegendColor: 'Color',
    modalAriaColor: 'Select bubble color',
    colorPickerHexLabel: 'Hex color',
    colorPickerOk: 'OK',
    modalAddColor: 'Add custom color',
    modalAddColorTitle: 'Add color',
    modalCancel: 'Cancel',
    modalSubmitCreate: 'Create Bubble',
    modalSubmitSave: 'Save',
    weekdayMon: 'Monday',
    weekdayTue: 'Tuesday',
    weekdayWed: 'Wednesday',
    weekdayThu: 'Thursday',
    weekdayFri: 'Friday',
    weekdaySat: 'Saturday',
    weekdaySun: 'Sunday',
    weekdayTasks: '{{day}} Tasks',
    colorBlue: 'Blue',
    colorPurple: 'Purple',
    colorRed: 'Red',
    colorGreen: 'Green',
    colorYellow: 'Yellow',
  },
  el: {
    languageLabel: 'Γλώσσα',
    languageName: 'Ελληνικά',
    pageTitleLanding: 'Οργανωτής Φυσαλίδων — Στιγμιότυπα',
    pageTitleEditor: 'Καμβάς Φυσαλίδων (Πίνακας)',
    appAriaLabel: 'Εφαρμογή καμβά φυσαλίδων',
    pageTitleView: 'Προβολή στιγμιότυπων φυσαλίδων',
    viewTitle: 'Εβδομαδιαία αναφορά',
    viewSubtitlePrefix: 'Προβολή μόνο για ανάγνωση αποθηκευμένων φυσαλίδων. Προσθέστε',
    viewSubtitleSuffix: 'στο URL για να εμφανίσετε συγκεκριμένο πίνακα. Οι γραμμές είναι μοναδικές χρονικές στιγμές (από νωρίς σε αργά)· οι στήλες είναι ημέρες.',
    viewStatusWaiting: 'Αναμονή για αναγνωριστικό στιγμιότυπου...',
    viewStatusNeedId: 'Προσθέστε ?id=<instance-id> στο URL για να εμφανίσετε αποθηκευμένο πίνακα.',
    viewStatusLoading: 'Φόρτωση...',
    viewStatusNotFound: 'Δεν βρέθηκαν δεδομένα για αυτό το στιγμιότυπο.',
    viewStatusNoBubbles: 'Δεν βρέθηκαν φυσαλίδες για αυτό το στιγμιότυπο.',
    viewStatusViewing: 'Προβολή στιγμιότυπου {{id}}',
    viewStatusError: 'Δεν ήταν δυνατή η φόρτωση δεδομένων. Ελέγξτε την κονσόλα.',
    viewTableLoading: 'Φόρτωση χρονολογίου...',
    viewTableNoData: 'Δεν υπάρχουν δεδομένα για αυτό το στιγμιότυπο.',
    viewTableNoBubbles: 'Δεν έχουν τοποθετηθεί φυσαλίδες ακόμα.',
    viewTableError: 'Σφάλμα κατά τη φόρτωση δεδομένων.',
    viewEmptyPrompt: 'Δώστε αναγνωριστικό στιγμιότυπου για φόρτωση δεδομένων.',
    viewTimeHeader: 'Ώρα',
    viewBubbleUntitled: 'Χωρίς τίτλο',
    viewNoTime: 'Χωρίς ώρα',
    viewCellPlaceholder: '—',
    landingTitle: 'Οργανωτής Φυσαλίδων',
    landingSubtitle: 'Μεταβείτε σε έναν υπάρχοντα προγραμματισμό με το αναγνωριστικό του ή δημιουργήστε ένα νέο πρότυπο και το πρώτο του στιγμιότυπο.',
    landingInputPlaceholder: 'Επικολλήστε ένα αναγνωριστικό στιγμιότυπου ή προτύπου…',
    landingInputLabel: 'Αναγνωριστικό στιγμιότυπου ή προτύπου',
    landingOpen: 'Άνοιγμα',
    landingNew: '+ Νέος προγραμματισμός',
    landingStatusWaiting: 'Αναμονή για αναγνωριστικό. Δώστε ένα σύνθετο ή αναγνωριστικό προτύπου ή δημιουργήστε έναν νέο προγραμματισμό.',
    landingStatusLooking: 'Αναζήτηση προτύπου…',
    landingStatusNoPrototype: 'Σφάλμα: δεν βρέθηκε πρότυπο για αυτό το αναγνωριστικό.',
    landingStatusRecreateError: 'Σφάλμα: δεν ήταν δυνατή η επαναδημιουργία του αποθηκευμένου προτύπου. Προσπαθήστε ξανά.',
    landingStatusProtoEmpty: 'Το πρότυπο βρέθηκε, αλλά δεν υπάρχουν ακόμη στιγμιότυπα. Δημιουργήστε ένα νέο παρακάτω.',
    landingStatusProtoFound: 'Το πρότυπο βρέθηκε. Επιλέξτε ένα στιγμιότυπο για άνοιγμα ή δημιουργήστε άλλο.',
    landingStatusLoadError: 'Κάτι πήγε στραβά κατά τη φόρτωση αυτού του προτύπου.',
    landingStatusCreate: 'Δημιουργία νέου προτύπου και του πρώτου του στιγμιότυπου…',
    landingStatusCreateFail: 'Δεν ήταν δυνατή η δημιουργία νέου προγραμματισμού αυτή τη στιγμή. Προσπαθήστε ξανά.',
    instanceLabelTemplate: 'Στιγμιότυπο #{{n}}',
    instanceEmpty: 'Δεν βρέθηκαν στιγμιότυπα για αυτό το πρότυπο ακόμη.',
    defaultPrototypeTask: 'Εργασία',
    defaultPrototypeIdea: 'Ιδέα',
    defaultPrototypeBug: 'Σφάλμα',
    defaultPrototypeNote: 'Σημείωση',
    defaultPrototypeInput: 'Είσοδος',
    defaultPrototypeOutput: 'Έξοδος',
    sidebarTitle: 'Βιβλιοθήκη Φυσαλίδων',
    sidebarClose: 'Κλείσιμο βιβλιοθήκης',
    sidebarHint: 'Σύρετε μια φυσαλίδα στον καμβά για να δημιουργήσετε ένα στιγμιότυπο.',
    sidebarAdd: 'Προσθήκη φυσαλίδας',
    sidebarAddAria: 'Προσθήκη φυσαλίδας',
    toolbarMenu: 'Άνοιγμα μενού',
    toolbarTitleDefault: 'Εβδομαδιαίος Προγραμματισμός',
    toolbarEdit: 'Επεξεργασία',
    toolbarDone: 'Τέλος',
    toolbarEditTooltip: 'Επεξεργασία',
    toolbarNameAria: 'Όνομα πλάνου',
    trashLabel: 'Απόθεση για διαγραφή',
    trashAria: 'Ζώνη διαγραφής',
    modalTitle: 'Δημιουργία νέας φυσαλίδας',
    modalLabelText: 'Κείμενο φυσαλίδας',
    modalPlaceholderText: 'π.χ. Ιδέα, Εργασία, Άτομο...',
    modalLabelDescription: 'Περιγραφή',
    modalPlaceholderDescription: 'Προαιρετική περιγραφή',
    modalLabelTime: 'Ώρα (ΩΩ:ΛΛ:ΔΔ)',
    modalPlaceholderTime: 'ΩΩ:ΛΛ ή ΩΩ:ΛΛ:ΔΔ',
    modalTimeHour: 'Ώρες',
    modalTimeMinute: 'Λεπτά',
    modalTimeSecond: 'Δευτερόλεπτα',
    modalLegendColor: 'Χρώμα',
    modalAriaColor: 'Επιλογή χρώματος φυσαλίδας',
    colorPickerHexLabel: 'Χρώμα (hex)',
    colorPickerOk: 'Εντάξει',
    modalAddColor: 'Προσθήκη χρώματος',
    modalAddColorTitle: 'Προσθήκη χρώματος',
    modalCancel: 'Ακύρωση',
    modalSubmitCreate: 'Δημιουργία',
    modalSubmitSave: 'Αποθήκευση',
    weekdayMon: 'Δευτέρα',
    weekdayTue: 'Τρίτη',
    weekdayWed: 'Τετάρτη',
    weekdayThu: 'Πέμπτη',
    weekdayFri: 'Παρασκευή',
    weekdaySat: 'Σάββατο',
    weekdaySun: 'Κυριακή',
    weekdayTasks: 'Εργασίες {{day}}',
    colorBlue: 'Μπλε',
    colorPurple: 'Μωβ',
    colorRed: 'Κόκκινο',
    colorGreen: 'Πράσινο',
    colorYellow: 'Κίτρινο',
  },
};

const STORAGE_KEY = 'organizer:lang';
const FALLBACK_LANG = 'el';
const listeners = new Set();

function normalizeLang(lang) {
  if (!lang) return null;
  const lower = String(lang).toLowerCase();
  if (translations[lower]) return lower;
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('el')) return 'el';
  return null;
}

function detectInitialLanguage() {
  try {
    const url = new URL(window.location.href);
    const fromQuery = normalizeLang(url.searchParams.get('lang'));
    if (fromQuery) return fromQuery;
  } catch {}
  return FALLBACK_LANG;
}

function format(template, vars = {}) {
  const str = typeof template === 'string' ? template : String(template ?? '');
  return str.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}

let currentLanguage = detectInitialLanguage();

function setLanguage(lang) {
  const next = normalizeLang(lang) || FALLBACK_LANG;
  const previous = currentLanguage;
  currentLanguage = next;
  try {
    document.documentElement.lang = next;
  } catch {}
  if (previous !== next) {
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    listeners.forEach((listener) => {
      try { listener(next); } catch {}
    });
  }
  return next;
}

function t(key, vars) {
  const langPack = translations[currentLanguage] || translations[FALLBACK_LANG] || {};
  const fallbackPack = translations[FALLBACK_LANG] || {};
  const raw = Object.prototype.hasOwnProperty.call(langPack, key)
    ? langPack[key]
    : fallbackPack[key] ?? key;
  return format(raw, vars);
}

function onChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getLanguage() {
  return currentLanguage;
}

function getAvailableLanguages() {
  return Object.keys(translations);
}

setLanguage(currentLanguage);

export const i18n = {
  t,
  setLanguage,
  getLanguage,
  onChange,
  getAvailableLanguages,
  translations,
};
