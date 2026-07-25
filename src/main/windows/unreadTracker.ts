export const UNREAD_TRACKER_CONSOLE_PREFIX = "__OMNIA_UNREAD__";

export type UnreadTrackerUpdate = {
  count: number;
  source: string;
};

const MAX_UNREAD_COUNT = 9999;

export const parseUnreadTrackerMessage = (
  message: string,
): UnreadTrackerUpdate | null => {
  if (!message.startsWith(UNREAD_TRACKER_CONSOLE_PREFIX)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      message.slice(UNREAD_TRACKER_CONSOLE_PREFIX.length),
    ) as Partial<UnreadTrackerUpdate>;

    if (typeof payload.count !== "number" || !Number.isFinite(payload.count)) {
      return null;
    }

    return {
      count: Math.max(0, Math.min(MAX_UNREAD_COUNT, Math.floor(payload.count))),
      source:
        typeof payload.source === "string" && payload.source.length > 0
          ? payload.source
          : "dom",
    };
  } catch {
    return null;
  }
};

export const createUnreadTrackerScript = () => `
(() => {
  const prefix = ${JSON.stringify(UNREAD_TRACKER_CONSOLE_PREFIX)};
  const maxUnreadCount = ${MAX_UNREAD_COUNT};

  if (window.__omniaUnreadTrackerInstalled) {
    return;
  }

  window.__omniaUnreadTrackerInstalled = true;

  const parseCount = (value) => {
    if (!value) {
      return null;
    }

    const normalized = String(value).replace(/\\u00a0/g, " ");
    const compactMatch = normalized.match(/(\\d+(?:[.,]\\d+)?)\\s*k\\+?/i);

    if (compactMatch) {
      return Math.min(maxUnreadCount, Math.floor(Number(compactMatch[1].replace(",", ".")) * 1000));
    }

    const numberMatch = normalized.match(/\\b(\\d[\\d\\s,.]*)\\+?\\b/);

    if (!numberMatch) {
      return null;
    }

    const digitsOnly = numberMatch[1].replace(/\\D/g, "");
    const count = Number.parseInt(digitsOnly, 10);

    if (!Number.isFinite(count)) {
      return null;
    }

    return Math.min(maxUnreadCount, count);
  };

  const parseUnreadText = (value) => {
    if (!value) {
      return null;
    }

    const text = String(value).replace(/\\s+/g, " ").trim();
    const unreadPhrase = text.match(/(\\d[\\d\\s,.]*|\\d+(?:[.,]\\d+)?\\s*k)\\+?\\s+unread/i);

    if (unreadPhrase) {
      return parseCount(unreadPhrase[1]);
    }

    const inboxPhrase = text.match(/\\bInbox\\b[^\\d]{0,40}(\\d[\\d\\s,.]*|\\d+(?:[.,]\\d+)?\\s*k)\\+?/i);

    if (inboxPhrase) {
      return parseCount(inboxPhrase[1]);
    }

    return null;
  };

  const readElementText = (element) =>
    [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-tooltip"),
      element.textContent,
    ]
      .filter(Boolean)
      .join(" ");

  const findFromElements = (selector) => {
    const elements = Array.from(document.querySelectorAll(selector));

    for (const element of elements) {
      const directCount = parseUnreadText(readElementText(element));

      if (directCount !== null) {
        return directCount;
      }

      // Gmail renders the unread badge next to the Inbox link rather than
      // inside it in some layouts. Walk a small number of ancestors so their
      // combined text includes that sibling without scanning the whole nav.
      let row = element.parentElement;
      let depth = 0;

      while (row && depth < 3) {
        const rowCount = parseUnreadText(readElementText(row));

        if (rowCount !== null) {
          return rowCount;
        }

        row = row.parentElement;
        depth += 1;
      }
    }

    return null;
  };

  const readGmail = () => {
    if (!/(^|\\.)mail\\.google\\./i.test(location.hostname)) {
      return null;
    }

    const inboxSelector = [
      'a[href="#inbox"]',
      'a[href$="#inbox"]',
      'a[href*="#inbox"]',
      'a[href*="/#inbox"]',
      '[aria-label*="Inbox" i]',
      '[data-tooltip="Inbox"]',
      '[title="Inbox"]',
    ].join(",");

    const count = findFromElements(inboxSelector);

    if (count !== null) {
      return count;
    }

    // The Inbox link can be present before Gmail has rendered its badge. Do
    // not turn "badge not found" into a false zero; the title is the fallback.
    return null;
  };

  const readTitle = () => {
    const titleMatch = document.title.match(/^\\((\\d[\\d\\s,.]*)\\+?\\)/);
    return titleMatch ? parseCount(titleMatch[1]) : null;
  };

  const emit = (count, source) => {
    const normalizedCount = Math.max(0, Math.min(maxUnreadCount, Math.floor(count)));
    const key = source + ":" + normalizedCount;

    if (window.__omniaLastUnreadKey === key) {
      return;
    }

    window.__omniaLastUnreadKey = key;
    console.info(prefix + JSON.stringify({ count: normalizedCount, source }));
  };

  const read = () => {
    const isGmail = /(^|\\.)mail\\.google\\./i.test(location.hostname);

    if (isGmail) {
      const gmailCount = readGmail();

      if (gmailCount !== null) {
        emit(gmailCount, "gmail-dom");
        return;
      }

      // Gmail removes the title prefix when the unread count reaches zero.
      // On a loaded Gmail page, a missing prefix is therefore a valid zero.
      const gmailTitleCount = readTitle();
      emit(gmailTitleCount ?? 0, "gmail-title");
      return;
    }

    const titleCount = readTitle();

    if (titleCount !== null) {
      emit(titleCount, "title");
    }
  };

  let readTimer = null;
  const scheduleRead = () => {
    if (readTimer) {
      return;
    }

    readTimer = window.setTimeout(() => {
      readTimer = null;
      read();
    }, 250);
  };

  const observer = new MutationObserver(scheduleRead);

  const startObserver = () => {
    const target = document.documentElement || document.body;

    if (!target) {
      return;
    }

    observer.observe(target, {
      attributes: true,
      attributeFilter: ["aria-label", "title", "data-tooltip"],
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startObserver();
      read();
    }, { once: true });
  } else {
    startObserver();
    read();
  }

  window.setInterval(read, 5000);
})();
`;
