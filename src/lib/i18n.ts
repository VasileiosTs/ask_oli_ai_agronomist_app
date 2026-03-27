export type Lang = 'el' | 'en';

export interface T {
  // Auth
  tagline: string;
  signInGoogle: string; signInFacebook: string;
  emailPlaceholder: string; magicLinkBtn: string;
  checkEmailTitle: string; magicLinkSentTo: string;
  continueAsGuest: string; termsOfService: string; privacyPolicy: string;
  // Onboarding
  step1Q: string; step1P: string;
  step2Q: string; step2P: string;
  step3Q: string; step3P: string;
  next: string; letsGo: string; saving: string;
  crops: string[]; savingError: string;
  // Chat - empty state
  chatSubtitle: string; suggestions: string[];
  // Chat - features (desktop welcome)
  feature1Title: string; feature1Desc: string;
  feature2Title: string; feature2Desc: string;
  feature3Title: string; feature3Desc: string;
  welcomeTitle: string; welcomeSubtitle: string; welcomeStart: string;
  // Chat - input
  inputPlaceholder: string; listening: string;
  // Chat - field selector
  allFields: string;
  // Chat - limit
  messagesLeft: string;
  // Chat - attachment sheet
  takePhoto: string; choosePhoto: string; uploadFile: string;
  // Chat - toasts & errors
  guestPrompt: string; connectionError: string;
  starSaveError: string;
  shareError: string; shareLinkError: string; shareClipboardError: string;
  voiceNotSupported: string;
  fileRejected: string; tooManyFiles: string;
  profileSyncing: string;
  interventionLogged: string;
  // Chat - actions
  savedMessage: string; removedMessage: string;
  linkCopied: string; shareLabel: string;
  logIntervention: string;
  shareTitle: string; shareDefaultText: string;
  // Error boundary
  errorTitle: string; errorBody: string; errorRefresh: string;
  // 404 page
  notFoundTitle: string; notFoundBody: string; notFoundHome: string;
  // Export
  exportFailed: string;
  // Conversation
  conversationCreateError: string;
  // Sidebar
  chatHistory: string; newChat: string; noConversations: string;
  today: string; yesterday: string;
  // Profile
  editProfile: string;
  nameLabel: string; locationLabel: string; cropLabel: string;
  save: string; cancel: string;
  subscription: string; unlimited: string; active: string;
  upgradeBtn: string; monthly: string; yearly: string; savings: string;
  settings: string; languageLabel: string;
  followUp: string; weeklyPlan: string;
  account: string; exportData: string; exporting: string;
  deleteAccount: string; signOut: string;
  deleteConfirmText: string; deleteConfirmWord: string;
  deleting: string; noProfile: string;
  signInToUse: string;
  signInToUseBody: string;
  guestMode: string; signInToManage: string; signInBtn: string;
  outcomeBetter: string; outcomeSame: string; outcomeWorse: string;
  outcomeRecorded: string;
  organicTreatments: string; chemicalTreatments: string;
  // Log intervention modal
  logIt: string; logging: string;
  cropType: string; problem: string; product: string;
  dosage: string; appMethod: string; notes: string;
  setReminder: string; reminderQuestion: string; noThanks: string;
  // Paywall
  paywallTitle: string; paywallBody: string;
  monthlyPlan: string; yearlyPlan: string;
  unlimitedMessages: string; cancelAnytime: string;
  // Fields (hidden page, data layer only)
  myFields: string; fieldsSubtitle: string;
  noFieldsTitle: string; noFieldsBody: string; addField: string;
  newField: string; editField: string;
  fieldName: string; fieldCrop: string; fieldLocation: string;
  fieldSize: string; fieldMedium: string; fieldSoil: string; fieldIrrigation: string;
  fieldDelete: string; fieldSave: string; fieldSaving: string;
  fieldOptionLabels: Record<string, string>;
  statusHealthy: string; statusWarning: string; statusCritical: string;
  guestFieldsTitle: string; guestFieldsBody: string;
  // History
  interventionHistory: string; historySubtitle: string;
  noHistoryTitle: string; noHistoryBody: string;
  appliedOn: string; followUpPending: string; outcomeLabel: string;
  productLabel: string; dosageLabel: string; methodLabel: string;
  stepApplyCheck: string; stepOutcomeCheck: string; stepComplete: string;
  daysAgo: string;
  // Push notifications
  pushNotifications: string; pushEnabled: string; pushDisabled: string;
  pushEnableBtn: string; pushDisableBtn: string; pushNotSupported: string;
  pushDenied: string;
  // Sidebar nav
  navChat: string; navHistory: string; navFields: string; navProfile: string;
  // Legal
  legalUpdated: string;
  privacyDataTitle: string; privacyDataAccount: string; privacyDataUsage: string; privacyDataTech: string;
  privacyHowTitle: string; privacyHowBody: string;
  privacyStorageTitle: string; privacyStorageBody: string; privacyStorageRls: string;
  privacyThirdTitle: string; privacyGemini: string; privacySentry: string; privacyVercel: string;
  privacyGdprTitle: string; privacyGdprAccess: string; privacyGdprDelete: string; privacyGdprCorrect: string; privacyGdprPortability: string;
  privacyCookies: string; privacyAge: string; privacyContact: string;
  termsNature: string; termsNatureBody: string;
  termsLiability: string; termsLiabilityBody: string;
  termsUse: string; termsUseBody: string;
  termsAccounts: string; termsAccountsBody: string;
  termsIp: string; termsIpBody: string;
  termsTermination: string; termsTerminationBody: string;
  termsLaw: string; termsLawBody: string;
  // Push prompt
  pushPromptTitle: string; pushPromptBody: string; pushPromptEnable: string; pushPromptLater: string;
  // Referral
  inviteFriends: string; inviteBody: string; inviteCopied: string; copyLink: string;
}

const el: T = {
  tagline: 'Ο AI γεωπόνος σου, πάντα δίπλα σου',
  signInGoogle: 'Σύνδεση με Google',
  signInFacebook: 'Σύνδεση με Facebook',
  emailPlaceholder: 'Το email σου',
  magicLinkBtn: 'Λήψη συνδέσμου εισόδου',
  checkEmailTitle: 'Έλεγξε το email σου',
  magicLinkSentTo: 'Στείλαμε σύνδεσμο εισόδου στο',
  continueAsGuest: 'Συνέχεια ως επισκέπτης',
  termsOfService: 'Όροι Χρήσης',
  privacyPolicy: 'Πολιτική Απορρήτου',
  step1Q: 'Πώς σε λένε;', step1P: 'π.χ. Γιάννης',
  step2Q: 'Πού καλλιεργείς;', step2P: 'Πόλη ή περιοχή',
  step3Q: 'Τι καλλιεργείς κυρίως;', step3P: 'π.χ. Ελιές, Τομάτες',
  next: 'Επόμενο', letsGo: 'Ξεκινάμε', saving: 'Αποθήκευση...',
  crops: ['Ελιές', 'Αμπελώνας', 'Τομάτα', 'Πορτοκάλια', 'Σιτάρι', 'Άλλο'],
  savingError: 'Δεν αποθηκεύτηκε το προφίλ. Δοκίμασε ξανά.',
  chatSubtitle: 'Ο AI γεωπόνος σου',
  suggestions: [
    'Τα φύλλα μου κιτρινίζουν, τι φταίει;',
    'Πότε να ψεκάσω τα ελαιόδεντρα;',
    'Ανέβασε φωτογραφία για διάγνωση',
    'Τι να κάνω αυτή την εβδομάδα;',
  ],
  feature1Title: 'Διάγνωση με φωτο', feature1Desc: 'Ανέβασε φωτογραφία και πάρε απάντηση σε δευτερόλεπτα',
  feature2Title: 'Μνήμη χωραφιού', feature2Desc: 'Θυμάται κάθε παρέμβαση και ιστορικό για κάθε καλλιέργεια',
  feature3Title: 'Καταγραφή', feature3Desc: 'Αποθήκευση διαγνώσεων και παρεμβάσεων αυτόματα',
  welcomeTitle: 'Γεια σου, είμαι ο Oli',
  welcomeSubtitle: 'Ο AI γεωπόνος σου — ρώτα οτιδήποτε για τις καλλιέργειές σου',
  welcomeStart: 'Ξεκίνα μια συνομιλία',
  inputPlaceholder: 'Ρώτα τον Oli...',
  listening: 'Ακούω...',
  allFields: 'Όλα τα χωράφια',
  messagesLeft: 'μηνύματα απομένουν',
  takePhoto: 'Φωτογραφία',
  choosePhoto: 'Επιλογή από γκαλερί',
  uploadFile: 'Αρχείο PDF',
  guestPrompt: 'Συνδέσου για να χρησιμοποιήσεις τον Oli. Είναι δωρεάν!',
  connectionError: 'Σφάλμα σύνδεσης. Δοκίμασε ξανά.',
  starSaveError: 'Δεν ήταν δυνατή η αποθήκευση.',
  shareError: 'Σφάλμα κοινοποίησης.',
  shareLinkError: 'Δεν δημιουργήθηκε σύνδεσμος.',
  shareClipboardError: 'Ο σύνδεσμος δημιουργήθηκε αλλά δεν αντιγράφηκε.',
  voiceNotSupported: 'Η φωνητική εισαγωγή δεν υποστηρίζεται σε αυτό το πρόγραμμα.',
  fileRejected: 'Μερικά αρχεία απορρίφθηκαν. Μέγιστο 10MB, τύποι: JPEG, PNG, WEBP, HEIC, PDF.',
  tooManyFiles: 'Μπορείς να επισυνάψεις έως 3 αρχεία κάθε φορά.',
  profileSyncing: 'Το προφίλ φορτώνει ακόμα. Δοκίμασε ξανά σε λίγο.',
  interventionLogged: 'Καταχωρήθηκε ✓',
  savedMessage: 'Αποθηκεύτηκε', removedMessage: 'Αφαιρέθηκε',
  linkCopied: 'Σύνδεσμος αντιγράφηκε!', shareLabel: 'Κοινοποίηση',
  logIntervention: 'Καταχώρηση',
  shareTitle: 'Oli — Διάγνωση', shareDefaultText: 'Δες αυτή τη διάγνωση από τον Oli',
  errorTitle: 'Κάτι πήγε στραβά', errorBody: 'Παρουσιάστηκε σφάλμα. Ανανεώστε τη σελίδα.', errorRefresh: 'Ανανέωση',
  notFoundTitle: 'Η σελίδα δεν βρέθηκε', notFoundBody: 'Η σελίδα που ψάχνεις δεν υπάρχει.', notFoundHome: 'Πίσω στην αρχική',
  exportFailed: 'Η εξαγωγή απέτυχε. Δοκιμάστε ξανά.',
  conversationCreateError: 'Αποτυχία δημιουργίας συνομιλίας.',
  chatHistory: 'Ιστορικό', newChat: 'Νέα Συνομιλία', noConversations: 'Δεν υπάρχουν συνομιλίες ακόμα',
  today: 'Σήμερα', yesterday: 'Χθες',
  editProfile: 'Επεξεργασία προφίλ',
  nameLabel: 'Όνομα', locationLabel: 'Τοποθεσία', cropLabel: 'Κύρια Καλλιέργεια',
  save: 'Αποθήκευση', cancel: 'Ακύρωση',
  subscription: 'Συνδρομή', unlimited: 'Απεριόριστα μηνύματα', active: 'Ενεργό',
  upgradeBtn: 'Αναβάθμιση σε Pro', monthly: '€4,99/μήνα', yearly: '€49/χρόνο', savings: '-18% Οικονομία',
  settings: 'Ρυθμίσεις', languageLabel: 'Γλώσσα',
  followUp: 'Υπενθυμίσεις follow-up', weeklyPlan: 'Εβδομαδιαίο πλάνο',
  account: 'Λογαριασμός', exportData: 'Εξαγωγή δεδομένων', exporting: 'Εξαγωγή...',
  deleteAccount: 'Διαγραφή λογαριασμού', signOut: 'Αποσύνδεση',
  deleteConfirmText: 'Αυτή η ενέργεια είναι μόνιμη. Γράψε ΔΙΑΓΡΑΦΗ για επιβεβαίωση.',
  deleteConfirmWord: 'ΔΙΑΓΡΑΦΗ',
  deleting: 'Διαγραφή...', noProfile: 'Δεν βρέθηκε προφίλ.',
  signInToUse: 'Σύνδεση στο Oli',
  signInToUseBody: 'Δημιούργησε δωρεάν λογαριασμό για να χρησιμοποιήσεις τον AI γεωπόνο σου.',
  guestMode: 'Λειτουργία επισκέπτη', signInToManage: 'Συνδέσου για να διαχειριστείς το προφίλ σου.',
  signInBtn: 'Σύνδεση / Εγγραφή',
  outcomeBetter: '✅ Βελτιώθηκε',
  outcomeSame: '➡️ Δεν άλλαξε',
  outcomeWorse: '⚠️ Χειροτέρεψε',
  outcomeRecorded: 'Αποτέλεσμα καταχωρήθηκε',
  organicTreatments: '🌿 Οργανικά',
  chemicalTreatments: '⚗️ Χημικά',
  logIt: 'Καταχώρηση', logging: 'Καταχώρηση...',
  cropType: 'Καλλιέργεια', problem: 'Πρόβλημα / Διάγνωση', product: 'Προϊόν',
  dosage: 'Δοσολογία', appMethod: 'Μέθοδος Εφαρμογής', notes: 'Σημειώσεις',
  setReminder: 'Ορισμός Υπενθύμισης', reminderQuestion: 'Θέλεις follow-up σε 3 μέρες;', noThanks: 'Όχι ευχαριστώ',
  paywallTitle: 'Ξεκλειδώστε το Oli Pro',
  paywallBody: 'Φτάσατε το όριο δωρεάν μηνυμάτων για αυτόν τον μήνα. Αναβαθμίστε για απεριόριστη πρόσβαση.',
  monthlyPlan: 'Μηνιαίο Πλάνο', yearlyPlan: 'Ετήσιο Πλάνο',
  unlimitedMessages: 'Απεριόριστα μηνύματα', cancelAnytime: 'Ακύρωση ανά πάσα στιγμή',
  myFields: 'Τα Χωράφια μου', fieldsSubtitle: 'Διαχείριση καλλιεργιών',
  noFieldsTitle: 'Καμία καλλιέργεια ακόμα', noFieldsBody: 'Πρόσθεσε την πρώτη σου καλλιέργεια', addField: 'Προσθήκη',
  newField: 'Νέο Χωράφι', editField: 'Επεξεργασία',
  fieldName: 'Όνομα *', fieldCrop: 'Καλλιέργεια', fieldLocation: 'Τοποθεσία',
  fieldSize: 'Έκταση (ha)', fieldMedium: 'Μέσο Καλλιέργειας', fieldSoil: 'Τύπος Εδάφους', fieldIrrigation: 'Άρδευση',
  fieldDelete: 'Διαγραφή', fieldSave: 'Αποθήκευσε', fieldSaving: 'Αποθήκευση...',
  fieldOptionLabels: {
    soil: 'Έδαφος', hydro: 'Υδροπονία', container: 'Γλάστρα', greenhouse: 'Θερμοκήπιο',
    argillous: 'Αργιλώδες', sandy: 'Αμμώδες', loamy: 'Πηλώδες', silty: 'Ιλυώδες', peaty: 'Τυρφώδες', chalky: 'Ασβεστώδες',
    drip: 'Σταγόνες', sprinkler: 'Ψεκαστήρες', furrow: 'Αυλάκι', flood: 'Κατάκλυση', 'rain-fed': 'Βροχή',
  },
  statusHealthy: 'Υγιές', statusWarning: 'Προσοχή', statusCritical: 'Κρίσιμο',
  guestFieldsTitle: 'Δημιουργία Λογαριασμού',
  guestFieldsBody: 'Συνδέσου για να αποθηκεύεις τα χωράφια σου και να έχεις προστατευμένη μνήμη.',
  interventionHistory: 'Ιστορικό Παρεμβάσεων', historySubtitle: 'Χρονολόγιο εφαρμογών & αποτελεσμάτων',
  noHistoryTitle: 'Κανένα ιστορικό ακόμα', noHistoryBody: 'Καταχώρησε μια παρέμβαση από τη συνομιλία.',
  appliedOn: 'Εφαρμογή:', followUpPending: 'Αναμονή follow-up', outcomeLabel: 'Αποτέλεσμα',
  productLabel: 'Προϊόν', dosageLabel: 'Δόση', methodLabel: 'Μέθοδος',
  stepApplyCheck: 'Εφαρμόστηκε;', stepOutcomeCheck: 'Βελτίωση;', stepComplete: 'Ολοκληρώθηκε',
  daysAgo: 'μέρες πριν',
  pushNotifications: 'Ειδοποιήσεις Push', pushEnabled: 'Ενεργές', pushDisabled: 'Ανενεργές',
  pushEnableBtn: 'Ενεργοποίηση', pushDisableBtn: 'Απενεργοποίηση', pushNotSupported: 'Δεν υποστηρίζεται σε αυτό το πρόγραμμα.',
  pushDenied: 'Οι ειδοποιήσεις έχουν αποκλειστεί. Ενεργοποίησέ τες από τις ρυθμίσεις του browser.',
  navChat: 'Συνομιλία', navHistory: 'Ιστορικό', navFields: 'Χωράφια', navProfile: 'Προφίλ',
  legalUpdated: 'Τελευταία ενημέρωση: Μάρτιος 2026',
  privacyDataTitle: 'Δεδομένα που συλλέγουμε',
  privacyDataAccount: 'Στοιχεία λογαριασμού: email, όνομα, τοποθεσία, κύρια καλλιέργεια.',
  privacyDataUsage: 'Δεδομένα χρήσης: μηνύματα chat, φωτογραφίες, δεδομένα αγροτεμαχίων, καταγεγραμμένες παρεμβάσεις, αποτελέσματα VIO.',
  privacyDataTech: 'Τεχνικά δεδομένα: διεύθυνση IP (μόνο για ασφάλεια), user agent, γλώσσα προτίμησης.',
  privacyHowTitle: 'Πώς χρησιμοποιούμε τα δεδομένα',
  privacyHowBody: 'Παροχή εξατομικευμένης αγρονομικής συμβουλής, βελτίωση της υπηρεσίας, αποστολή follow-up ειδοποιήσεων για τον κύκλο VIO.',
  privacyStorageTitle: 'Αποθήκευση & Ασφάλεια',
  privacyStorageBody: 'Supabase EU (Frankfurt) — GDPR compliant. Κρυπτογράφηση at rest και in transit.',
  privacyStorageRls: 'Κάθε χρήστης βλέπει μόνο τα δικά του δεδομένα.',
  privacyThirdTitle: 'Τρίτα μέρη',
  privacyGemini: 'Τα μηνύματα αποστέλλονται στο Gemini API για AI επεξεργασία. Η Google δεν αποθηκεύει τα δεδομένα πέραν της επεξεργασίας.',
  privacySentry: 'Αναφορές σφαλμάτων (χωρίς προσωπικά δεδομένα).',
  privacyVercel: 'Hosting — EU edge nodes.',
  privacyGdprTitle: 'Δικαιώματά σας (GDPR)',
  privacyGdprAccess: 'Profile → Εξαγωγή δεδομένων (JSON).',
  privacyGdprDelete: 'Profile → Διαγραφή λογαριασμού — διαγράφονται ΟΛΑ τα δεδομένα.',
  privacyGdprCorrect: 'Profile → Επεξεργασία προφίλ.',
  privacyGdprPortability: 'Τα δεδομένα εξάγονται σε JSON format.',
  privacyCookies: 'Κανένα advertising cookie. Μόνο essential session cookies για authentication.',
  privacyAge: 'Η υπηρεσία προορίζεται για χρήστες άνω των 18 ετών.',
  privacyContact: 'Για θέματα προστασίας δεδομένων: privacy@askoli.ai',
  termsNature: 'Φύση της υπηρεσίας',
  termsNatureBody: 'Το Oli παρέχει AI συμβουλές για ενημέρωση μόνο. Δεν αντικαθιστά τον επιστημονικό αγρονομικό σύμβουλο. Πάντα συμβουλευτείτε έναν πιστοποιημένο αγρονόμο πριν την εφαρμογή χημικών σκευασμάτων.',
  termsLiability: 'Περιορισμός ευθύνης',
  termsLiabilityBody: 'Το Oli δεν ευθύνεται για απώλειες στη σοδειά, ζημιές από λανθασμένη εφαρμογή συμβουλών, ή οποιαδήποτε έμμεση ζημία.',
  termsUse: 'Αποδεκτή χρήση',
  termsUseBody: 'Απαγορεύεται η κατάχρηση, η αντίστροφη μηχανολόγηση, η αποστολή spam ή κακόβουλου περιεχομένου, η χρήση για παράνομους σκοπούς.',
  termsAccounts: 'Λογαριασμοί',
  termsAccountsBody: 'Οι χρήστες πρέπει να είναι άνω των 18 ετών. Κάθε χρήστης δικαιούται έναν λογαριασμό. Η δωρεάν βαθμίδα περιλαμβάνει 20 μηνύματα/μήνα.',
  termsIp: 'Πνευματική ιδιοκτησία',
  termsIpBody: 'Το περιεχόμενο που δημιουργείτε παραμένει δικό σας. Μας παρέχετε άδεια επεξεργασίας για τη λειτουργία της υπηρεσίας.',
  termsTermination: 'Τερματισμός',
  termsTerminationBody: 'Διατηρούμε το δικαίωμα αναστολής λογαριασμών που παραβιάζουν τους όρους. Μπορείτε να διαγράψετε τον λογαριασμό σας ανά πάσα στιγμή.',
  termsLaw: 'Εφαρμοστέο δίκαιο',
  termsLawBody: 'Εφαρμόζεται το ελληνικό δίκαιο. Αρμόδια δικαστήρια τα δικαστήρια Αθηνών.',
  pushPromptTitle: 'Ειδοποιήσεις', pushPromptBody: 'Ενεργοποίησε τις ειδοποιήσεις για follow-up υπενθυμίσεις.', pushPromptEnable: 'Ενεργοποίηση', pushPromptLater: 'Αργότερα',
  inviteFriends: 'Προσκάλεσε φίλους', inviteBody: 'Μοιράσου τον Oli με άλλους αγρότες.', inviteCopied: 'Ο σύνδεσμος αντιγράφηκε!', copyLink: 'Αντιγραφή συνδέσμου',
};

const en: T = {
  tagline: 'Your AI agronomist, always by your side',
  signInGoogle: 'Continue with Google',
  signInFacebook: 'Continue with Facebook',
  emailPlaceholder: 'Your email',
  magicLinkBtn: 'Get sign-in link',
  checkEmailTitle: 'Check your email',
  magicLinkSentTo: 'We sent a sign-in link to',
  continueAsGuest: 'Continue as guest',
  termsOfService: 'Terms of Service',
  privacyPolicy: 'Privacy Policy',
  step1Q: "What's your name?", step1P: 'e.g. John',
  step2Q: 'Where do you farm?', step2P: 'City or region',
  step3Q: 'What is your main crop?', step3P: 'e.g. Olives, Tomatoes',
  next: 'Next', letsGo: "Let's start", saving: 'Saving...',
  crops: ['Olives', 'Vineyard', 'Tomatoes', 'Oranges', 'Wheat', 'Other'],
  savingError: 'Could not save profile. Please try again.',
  chatSubtitle: 'Your AI agronomist',
  suggestions: [
    'My leaves are turning yellow, what is wrong?',
    'When should I spray my olive trees?',
    'Upload a photo for diagnosis',
    'What should I do this week?',
  ],
  feature1Title: 'Photo diagnosis', feature1Desc: 'Upload a photo and get an answer in seconds',
  feature2Title: 'Field memory', feature2Desc: 'Remembers every intervention and history per field',
  feature3Title: 'Logging', feature3Desc: 'Automatically saves diagnoses and interventions',
  welcomeTitle: 'Hi, I am Oli',
  welcomeSubtitle: 'Your AI agronomist — ask anything about your crops',
  welcomeStart: 'Start a conversation',
  inputPlaceholder: 'Ask Oli...',
  listening: 'Listening...',
  allFields: 'All fields',
  messagesLeft: 'messages remaining',
  takePhoto: 'Take Photo',
  choosePhoto: 'Choose from gallery',
  uploadFile: 'Upload PDF',
  guestPrompt: 'Sign in to use Oli. It is free!',
  connectionError: 'Connection error. Please try again.',
  starSaveError: 'Could not save message.',
  shareError: 'Failed to share.',
  shareLinkError: 'Could not create share link.',
  shareClipboardError: 'Link created but could not copy to clipboard.',
  voiceNotSupported: 'Voice input is not supported on this browser.',
  fileRejected: 'Some files were rejected. Max 10MB, types: JPEG, PNG, WEBP, HEIC, PDF.',
  tooManyFiles: 'You can attach up to 3 files at a time.',
  profileSyncing: 'Profile is still loading. Please try again in a moment.',
  interventionLogged: 'Logged ✓',
  savedMessage: 'Saved', removedMessage: 'Removed',
  linkCopied: 'Link copied!', shareLabel: 'Share',
  logIntervention: 'Log',
  shareTitle: 'Oli — Diagnosis', shareDefaultText: 'Check out this diagnosis from Oli',
  errorTitle: 'Something went wrong', errorBody: 'An error occurred. Please refresh the page.', errorRefresh: 'Refresh',
  notFoundTitle: 'Page not found', notFoundBody: 'The page you are looking for does not exist.', notFoundHome: 'Back to home',
  exportFailed: 'Export failed. Please try again.',
  conversationCreateError: 'Failed to create conversation.',
  chatHistory: 'History', newChat: 'New Chat', noConversations: 'No conversations yet',
  today: 'Today', yesterday: 'Yesterday',
  editProfile: 'Edit profile',
  nameLabel: 'Name', locationLabel: 'Location', cropLabel: 'Main Crop',
  save: 'Save', cancel: 'Cancel',
  subscription: 'Subscription', unlimited: 'Unlimited messages', active: 'Active',
  upgradeBtn: 'Upgrade to Pro', monthly: '€4.99/month', yearly: '€49/year', savings: '-18% savings',
  settings: 'Settings', languageLabel: 'Language',
  followUp: 'Follow-up reminders', weeklyPlan: 'Weekly plan',
  account: 'Account', exportData: 'Export data', exporting: 'Exporting...',
  deleteAccount: 'Delete account', signOut: 'Sign out',
  deleteConfirmText: 'This action is permanent. Type DELETE to confirm.',
  deleteConfirmWord: 'DELETE',
  deleting: 'Deleting...', noProfile: 'Profile not found.',
  signInToUse: 'Sign in to Oli',
  signInToUseBody: 'Create a free account to use your AI agronomist.',
  guestMode: 'Guest mode', signInToManage: 'Sign in to manage your profile.',
  signInBtn: 'Sign in / Register',
  outcomeBetter: '✅ Improved',
  outcomeSame: '➡️ No change',
  outcomeWorse: '⚠️ Got worse',
  outcomeRecorded: 'Outcome recorded',
  organicTreatments: '🌿 Organic',
  chemicalTreatments: '⚗️ Chemical',
  logIt: 'Log it', logging: 'Logging...',
  cropType: 'Crop', problem: 'Problem / Diagnosis', product: 'Product',
  dosage: 'Dosage', appMethod: 'Application Method', notes: 'Notes',
  setReminder: 'Set Reminder', reminderQuestion: 'Set a follow-up check-in in 3 days?', noThanks: 'No thanks',
  paywallTitle: 'Unlock Oli Pro',
  paywallBody: 'You have reached the free message limit for this month. Upgrade for unlimited access.',
  monthlyPlan: 'Monthly Plan', yearlyPlan: 'Yearly Plan',
  unlimitedMessages: 'Unlimited messages', cancelAnytime: 'Cancel anytime',
  myFields: 'My Fields', fieldsSubtitle: 'Manage your crops',
  noFieldsTitle: 'No fields yet', noFieldsBody: 'Add your first field', addField: 'Add',
  newField: 'New Field', editField: 'Edit',
  fieldName: 'Name *', fieldCrop: 'Crop', fieldLocation: 'Location',
  fieldSize: 'Size (ha)', fieldMedium: 'Growing Medium', fieldSoil: 'Soil Type', fieldIrrigation: 'Irrigation',
  fieldDelete: 'Delete', fieldSave: 'Save', fieldSaving: 'Saving...',
  fieldOptionLabels: {
    soil: 'Soil', hydro: 'Hydroponic', container: 'Container', greenhouse: 'Greenhouse',
    argillous: 'Clay', sandy: 'Sandy', loamy: 'Loamy', silty: 'Silty', peaty: 'Peaty', chalky: 'Chalky',
    drip: 'Drip', sprinkler: 'Sprinkler', furrow: 'Furrow', flood: 'Flood', 'rain-fed': 'Rain-fed',
  },
  statusHealthy: 'Healthy', statusWarning: 'Warning', statusCritical: 'Critical',
  guestFieldsTitle: 'Create an Account',
  guestFieldsBody: 'Sign in to save your fields and keep your farming history protected.',
  interventionHistory: 'Intervention History', historySubtitle: 'Timeline of treatments & outcomes',
  noHistoryTitle: 'No history yet', noHistoryBody: 'Log an intervention from the chat to get started.',
  appliedOn: 'Applied:', followUpPending: 'Follow-up pending', outcomeLabel: 'Outcome',
  productLabel: 'Product', dosageLabel: 'Dosage', methodLabel: 'Method',
  stepApplyCheck: 'Applied?', stepOutcomeCheck: 'Improved?', stepComplete: 'Complete',
  daysAgo: 'days ago',
  pushNotifications: 'Push Notifications', pushEnabled: 'Enabled', pushDisabled: 'Disabled',
  pushEnableBtn: 'Enable', pushDisableBtn: 'Disable', pushNotSupported: 'Not supported on this browser.',
  pushDenied: 'Notifications are blocked. Enable them in your browser settings.',
  navChat: 'Chat', navHistory: 'History', navFields: 'Fields', navProfile: 'Profile',
  legalUpdated: 'Last updated: March 2026',
  privacyDataTitle: 'Data we collect',
  privacyDataAccount: 'Account details: email, name, location, primary crop.',
  privacyDataUsage: 'Usage data: chat messages, photos, field data, logged interventions, VIO outcomes.',
  privacyDataTech: 'Technical data: IP address (security only), user agent, preferred language.',
  privacyHowTitle: 'How we use your data',
  privacyHowBody: 'Providing personalized agronomic advice, improving the service, sending VIO follow-up reminders.',
  privacyStorageTitle: 'Storage & Security',
  privacyStorageBody: 'Supabase EU (Frankfurt) — GDPR compliant. Encryption at rest and in transit.',
  privacyStorageRls: 'Each user can only see their own data (Row-Level Security).',
  privacyThirdTitle: 'Third parties',
  privacyGemini: 'Messages are sent to Gemini API for AI processing. Google does not store data beyond processing.',
  privacySentry: 'Error reports (no personal data).',
  privacyVercel: 'Hosting — EU edge nodes.',
  privacyGdprTitle: 'Your rights (GDPR)',
  privacyGdprAccess: 'Profile → Export data (JSON).',
  privacyGdprDelete: 'Profile → Delete account — ALL data is permanently removed.',
  privacyGdprCorrect: 'Profile → Edit profile.',
  privacyGdprPortability: 'Data is exported in JSON format.',
  privacyCookies: 'No advertising cookies. Only essential session cookies for authentication.',
  privacyAge: 'The service is intended for users aged 18 and over.',
  privacyContact: 'For data protection inquiries: privacy@askoli.ai',
  termsNature: 'Nature of the service',
  termsNatureBody: 'Oli provides AI advice for informational purposes only. It does not replace a certified agronomist. Always consult a professional before applying chemical treatments.',
  termsLiability: 'Limitation of liability',
  termsLiabilityBody: 'Oli is not liable for crop losses, damages from misapplied advice, or any indirect damages.',
  termsUse: 'Acceptable use',
  termsUseBody: 'Prohibited: abuse or reverse engineering, sending spam or malicious content, attempting to extract the AI model, use for illegal purposes.',
  termsAccounts: 'Accounts',
  termsAccountsBody: 'Users must be 18 or older. Each user is entitled to one account. The free tier includes 20 messages per month.',
  termsIp: 'Intellectual property',
  termsIpBody: 'Content you create (messages, photos) remains yours. You grant us a license to process it for the operation of the service.',
  termsTermination: 'Termination',
  termsTerminationBody: 'We reserve the right to suspend accounts that violate these terms. You can delete your account at any time from your Profile.',
  termsLaw: 'Governing law',
  termsLawBody: 'Greek law applies. The courts of Athens have exclusive jurisdiction.',
  pushPromptTitle: 'Notifications', pushPromptBody: 'Enable notifications for VIO follow-up reminders.', pushPromptEnable: 'Enable', pushPromptLater: 'Later',
  inviteFriends: 'Invite friends', inviteBody: 'Share Oli with other farmers.', inviteCopied: 'Link copied!', copyLink: 'Copy link',
};

export const dict: Record<Lang, T> = { el, en };

export async function detectLang(): Promise<Lang> {
  // User's explicit choice always wins
  const manual = localStorage.getItem('oli_lang_manual') as Lang | null;
  if (manual === 'el' || manual === 'en') return manual;
  // Legacy key from older sessions
  const legacy = localStorage.getItem('oli_lang') as Lang | null;
  if (legacy === 'el' || legacy === 'en') return legacy;

  // Auto-detect from IP every time (no caching — stale 'en' was causing issues)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    const lang: Lang = (data.country_code === 'GR' || data.country_code === 'CY') ? 'el' : 'en';
    return lang;
  } catch {
    // Fall back to browser language
    const browserLang = navigator.language?.startsWith('el') ? 'el' : 'en';
    return browserLang;
  }
}
