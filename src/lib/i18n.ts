export type Lang = 'el' | 'en';

export interface T {
  tagline: string;
  signInGoogle: string;
  signInFacebook: string;
  emailPlaceholder: string;
  magicLinkBtn: string;
  checkEmailTitle: string;
  magicLinkSentTo: string;
  continueAsGuest: string;
  termsOfService: string;
  privacyPolicy: string;
  step1Q: string; step1P: string;
  step2Q: string; step2P: string;
  step3Q: string; step3P: string;
  next: string; letsGo: string; saving: string;
  crops: string[];
  savingError: string;
  chatSubtitle: string;
  suggestions: string[];
  inputPlaceholder: string;
  listening: string;
  messagesLeft: string;
  guestPrompt: string;
  connectionError: string;
  chatHistory: string;
  newChat: string;
  noConversations: string;
  today: string; yesterday: string;
  editProfile: string;
  nameLabel: string; locationLabel: string; cropLabel: string;
  save: string; cancel: string;
  subscription: string;
  unlimited: string; active: string;
  upgradeBtn: string; monthly: string; yearly: string; savings: string;
  settings: string; languageLabel: string;
  followUp: string; weeklyPlan: string;
  account: string; exportData: string; exporting: string;
  deleteAccount: string; signOut: string;
  deleteConfirmText: string; deleteConfirmWord: string;
  deleting: string; noProfile: string;
  logIntervention: string; interventionLogged: string;
  cropType: string; problem: string; product: string;
  dosage: string; appMethod: string; notes: string;
  logIt: string; logging: string;
  setReminder: string; reminderQuestion: string; noThanks: string;
  savedMessage: string; removedMessage: string;
  linkCopied: string; shareLabel: string;
  guestMode: string; signInToManage: string; signInBtn: string;
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
  inputPlaceholder: 'Ρώτα τον Oli...',
  listening: 'Ακούω...',
  messagesLeft: 'μηνύματα απομένουν',
  guestPrompt: 'Συνδέσου για να χρησιμοποιήσεις τον Oli. Είναι δωρεάν!',
  connectionError: 'Σφάλμα σύνδεσης. Δοκίμασε ξανά.',
  chatHistory: 'Ιστορικό',
  newChat: 'Νέα Συνομιλία',
  noConversations: 'Δεν υπάρχουν συνομιλίες ακόμα',
  today: 'Σήμερα', yesterday: 'Χθες',
  editProfile: 'Επεξεργασία προφίλ',
  nameLabel: 'Όνομα', locationLabel: 'Τοποθεσία', cropLabel: 'Κύρια Καλλιέργεια',
  save: 'Αποθήκευση', cancel: 'Ακύρωση',
  subscription: 'Συνδρομή',
  unlimited: 'Απεριόριστα μηνύματα', active: 'Ενεργό',
  upgradeBtn: 'Αναβάθμιση σε Pro', monthly: '€4,99/μήνα', yearly: '€49/χρόνο', savings: '-18% Οικονομία',
  settings: 'Ρυθμίσεις', languageLabel: 'Γλώσσα',
  followUp: 'Υπενθυμίσεις follow-up', weeklyPlan: 'Εβδομαδιαίο πλάνο',
  account: 'Λογαριασμός', exportData: 'Εξαγωγή δεδομένων', exporting: 'Εξαγωγή...',
  deleteAccount: 'Διαγραφή λογαριασμού', signOut: 'Αποσύνδεση',
  deleteConfirmText: 'Αυτή η ενέργεια είναι μόνιμη. Γράψε ΔΙΑΓΡΑΦΗ για επιβεβαίωση.',
  deleteConfirmWord: 'ΔΙΑΓΡΑΦΗ',
  deleting: 'Διαγραφή...', noProfile: 'Δεν βρέθηκε προφίλ.',
  logIntervention: 'Καταχώρηση', interventionLogged: 'Καταχωρήθηκε ✓',
  cropType: 'Καλλιέργεια', problem: 'Πρόβλημα / Διάγνωση', product: 'Προϊόν',
  dosage: 'Δοσολογία', appMethod: 'Μέθοδος Εφαρμογής', notes: 'Σημειώσεις',
  logIt: 'Καταχώρηση', logging: 'Καταχώρηση...',
  setReminder: 'Ορισμός Υπενθύμισης', reminderQuestion: 'Θέλεις υπενθύμιση σε 13 μέρες;', noThanks: 'Όχι ευχαριστώ',
  savedMessage: 'Αποθηκεύτηκε', removedMessage: 'Αφαιρέθηκε',
  linkCopied: 'Σύνδεσμος αντιγράφηκε!', shareLabel: 'Κοινοποίηση',
  guestMode: 'Λειτουργία επισκέπτη', signInToManage: 'Συνδέσου για να διαχειριστείς το προφίλ σου.',
  signInBtn: 'Σύνδεση / Εγγραφή',
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
  inputPlaceholder: 'Ask Oli...',
  listening: 'Listening...',
  messagesLeft: 'messages remaining',
  guestPrompt: 'Sign in to use Oli. It is free!',
  connectionError: 'Connection error. Please try again.',
  chatHistory: 'History',
  newChat: 'New Chat',
  noConversations: 'No conversations yet',
  today: 'Today', yesterday: 'Yesterday',
  editProfile: 'Edit profile',
  nameLabel: 'Name', locationLabel: 'Location', cropLabel: 'Main Crop',
  save: 'Save', cancel: 'Cancel',
  subscription: 'Subscription',
  unlimited: 'Unlimited messages', active: 'Active',
  upgradeBtn: 'Upgrade to Pro', monthly: '€4.99/month', yearly: '€49/year', savings: '-18% savings',
  settings: 'Settings', languageLabel: 'Language',
  followUp: 'Follow-up reminders', weeklyPlan: 'Weekly plan',
  account: 'Account', exportData: 'Export data', exporting: 'Exporting...',
  deleteAccount: 'Delete account', signOut: 'Sign out',
  deleteConfirmText: 'This action is permanent. Type DELETE to confirm.',
  deleteConfirmWord: 'DELETE',
  deleting: 'Deleting...', noProfile: 'Profile not found.',
  logIntervention: 'Log', interventionLogged: 'Logged ✓',
  cropType: 'Crop', problem: 'Problem / Diagnosis', product: 'Product',
  dosage: 'Dosage', appMethod: 'Application Method', notes: 'Notes',
  logIt: 'Log it', logging: 'Logging...',
  setReminder: 'Set Reminder', reminderQuestion: 'Set a follow-up reminder for 13 days?', noThanks: 'No thanks',
  savedMessage: 'Saved', removedMessage: 'Removed',
  linkCopied: 'Link copied!', shareLabel: 'Share',
  guestMode: 'Guest mode', signInToManage: 'Sign in to manage your profile.',
  signInBtn: 'Sign in / Register',
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
