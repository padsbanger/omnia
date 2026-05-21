const isGoogleOAuthPopupUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (
      !hostname.endsWith('google.com') &&
      !hostname.endsWith('googleapis.com') &&
      !hostname.endsWith('googleusercontent.com')
    ) {
      return false;
    }

    return (
      parsed.pathname.includes('/o/oauth2/') ||
      parsed.pathname.includes('/gsi/') ||
      parsed.pathname.includes('RotateCookiesPage')
    );
  } catch {
    return false;
  }
};

export default isGoogleOAuthPopupUrl;