export const getCurrentLocale = (): string => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('selectedLanguage');
    if (stored) return stored;
  }
  return (navigator.language || 'en').split('-')[0];
};
