export type Lang = 'el' | 'en' | 'it' | 'es' | 'fr' | 'ar';

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
  step4Q: string; ageRanges: string[]; skipAge: string;
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
  privacyThirdTitle: string; privacyGemini: string; privacySentry: string; privacyVercel: string; privacyPostHog: string;
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
  // Field detail
  fieldDetailTimeline: string; fieldDetailNoActivity: string;
  fieldDetailAskOli: string; fieldDetailTreatments: string;
  fieldDetailPending: string; fieldDetailChats: string;
  fieldDetailPendingFollowups: string; fieldDetailLastIssue: string;
  fieldDetailNotFound: string; fieldDetailDue: string;
  // Growth stages
  stageGermination: string; stageVegetative: string; stageFlowering: string;
  stageFruiting: string; stageMaturity: string; stageDormant: string;
  stageDay: string;
  // Tier limits
  fieldLimitReached: string; fieldLimitBody: string;
  // RL1: Renamed from messagesPerWeek — backend enforces monthly, not weekly
  messagesPerMonth: string;
}

export { dict } from './i18n-dict';

export const LANG_OPTIONS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'el', label: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export async function detectLang(): Promise<Lang> {
  // User's explicit choice always wins
  const manual = localStorage.getItem('oli_lang_manual') as Lang | null;
  if (manual && (manual === 'el' || manual === 'en' || manual === 'it' || manual === 'es' || manual === 'fr' || manual === 'ar')) return manual;
  // Legacy key from older sessions
  const legacy = localStorage.getItem('oli_lang') as Lang | null;
  if (legacy === 'el' || legacy === 'en') return legacy;

  const browserLang = navigator.language?.toLowerCase() ?? '';
  if (browserLang.startsWith('el')) return 'el';
  if (browserLang.startsWith('it')) return 'it';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('ar')) return 'ar';

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone === 'Europe/Athens' || timezone === 'Asia/Nicosia') return 'el';
  if (timezone?.startsWith('Europe/Rome') || timezone === 'Europe/Vatican') return 'it';
  if (timezone?.startsWith('Europe/Madrid') || timezone === 'Atlantic/Canary') return 'es';
  if (timezone?.startsWith('Europe/Paris') || timezone === 'Indian/Reunion') return 'fr';

  return 'en';
}
