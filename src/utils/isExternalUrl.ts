// Helper to determine if URL should be opened externally
function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false; // malformed URL - let the view handle it
  }
}

export default isExternalUrl;
