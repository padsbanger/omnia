import {
  MAX_UNREAD_COUNT,
  UNREAD_TITLE_COUNT_PATTERN_SOURCE,
} from "../../common/utils/extractUnreadFromTitle";

export const UNREAD_TRACKER_CONSOLE_PREFIX = "__OMNIA_UNREAD__";

export type UnreadTrackerUpdate = {
  count: number;
  source: string;
};

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
  const titleCountPattern = ${JSON.stringify(UNREAD_TITLE_COUNT_PATTERN_SOURCE)};

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

  const readElementValues = (element) =>
    [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-tooltip"),
      element.textContent,
    ]
      .filter(Boolean);

  const readElementText = (element) =>
    readElementValues(element).join(" ");

  const isElementVisible = (element) => {
    if (element.closest('[hidden], [aria-hidden="true"]')) {
      return false;
    }

    if (typeof window.getComputedStyle === "function") {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }

    return (
      typeof element.getClientRects !== "function" ||
      element.getClientRects().length > 0
    );
  };

  const parseExactCount = (value) => {
    if (!value) {
      return null;
    }

    const match = String(value)
      .replace(/\u00a0/g, " ")
      .trim()
      .match(/^(\\d+(?:[.,]\\d+)?\\s*k|\\d[\\d\\s,.]*)\\+?$/i);

    return match ? parseCount(match[1]) : null;
  };

  const findSiblingBadgeCount = (row, inboxElement) => {
    const visibleLinks = Array.from(row.querySelectorAll('a[href]'))
      .filter(isElementVisible);

    // An ancestor with several links is the mailbox navigation container,
    // not the Inbox row. Scanning it can steal another label's badge.
    if (visibleLinks.length > 1) {
      return { count: null, reachedNavigationContainer: true };
    }

    const candidates = Array.from(
      row.querySelectorAll('[aria-label], [title], [data-tooltip], span, div'),
    );

    for (const candidate of candidates) {
      if (
        candidate === row ||
        candidate === inboxElement ||
        candidate.contains(inboxElement) ||
        inboxElement.contains(candidate) ||
        !isElementVisible(candidate)
      ) {
        continue;
      }

      for (const value of readElementValues(candidate)) {
        const count = parseExactCount(value);
        if (count !== null) {
          return { count, reachedNavigationContainer: false };
        }
      }
    }

    return { count: null, reachedNavigationContainer: false };
  };

  const findFromElements = (selector) => {
    const elements = Array.from(document.querySelectorAll(selector));

    for (const element of elements) {
      if (!isElementVisible(element)) {
        continue;
      }

      const directText = readElementText(element);
      const directCount = parseUnreadText(directText) ?? parseCount(directText);

      if (directCount !== null) {
        return directCount;
      }

      // Gmail renders the unread badge next to the Inbox link rather than
      // inside it in some layouts. Inspect exact numeric badge elements in
      // the nearest row, then stop before reaching the full mailbox nav.
      let row = element.parentElement;
      let depth = 0;

      while (row && depth < 4) {
        const { count, reachedNavigationContainer } = findSiblingBadgeCount(
          row,
          element,
        );

        if (count !== null) {
          return count;
        }

        if (reachedNavigationContainer) {
          break;
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
    const titleMatch = document.title.match(new RegExp(titleCountPattern, "i"));
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

      // Gmail removes the numeric marker when the unread count reaches zero.
      // The pattern supports both "(12) Inbox" and localized/suffix formats
      // such as "Odebrane (12)".
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
