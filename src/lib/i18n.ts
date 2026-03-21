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
  statusHealthy: string; statusWarning: string; statusCritical: string;
  guestFieldsTitle: string; guestFieldsBody: string;
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
  logIt: 'Καταχώρηση', logging: 'Καταχώρηση...',
  cropType: 'Καλλιέργεια', problem: 'Πρόβλημα / Διάγνωση', product: 'Προϊόν',
  dosage: 'Δοσολογία', appMethod: 'Μέθοδος Εφαρμογής', notes: 'Σημειώσεις',
  setReminder: 'Ορισμός Υπενθύμισης', reminderQuestion: 'Θέλεις υπενθύμιση σε 13 μέρες;', noThanks: 'Όχι ευχαριστώ',
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
  statusHealthy: 'Υγιές', statusWarning: 'Προσοχή', statusCritical: 'Κρίσιμο',
  guestFieldsTitle: 'Δημιουργία Λογαριασμού',
  guestFieldsBody: 'Συνδέσου για να αποθηκεύεις τα χωράφια σου και να έχεις προστατευμένη μνήμη.',
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
  logIt: 'Log it', logging: 'Logging...',
  cropType: 'Crop', problem: 'Problem / Diagnosis', product: 'Product',
  dosage: 'Dosage', appMethod: 'Application Method', notes: 'Notes',
  setReminder: 'Set Reminder', reminderQuestion: 'Set a follow-up reminder for 13 days?', noThanks: 'No thanks',
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
  statusHealthy: 'Healthy', statusWarning: 'Warning', statusCritical: 'Critical',
  guestFieldsTitle: 'Create an Account',
  guestFieldsBody: 'Sign in to save your fields and keep your farming history protected.',
};

export const dict: Record<Lang, T> = { el, en };

export async function detectLang(): Promise<Lang> {
  const cached = localStorage.getItem('oli_lang') as Lang | null;
  if (cached === 'el' || cached === 'en') return cached;
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    const lang: Lang = (data.country_code === 'GR' || data.country_code === 'CY') ? 'el' : 'en';
    localStorage.setItem('oli_lang', lang);
    return lang;
  } catch {
    const lang: Lang = navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en';
    localStorage.setItem('oli_lang', lang);
    return lang;
  }
}
