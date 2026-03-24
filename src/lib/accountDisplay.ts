export function shortenMiddle(value: string, head = 18, tail = 10) {
  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function normalizeUrlDisplay(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length === 0) {
      return host;
    }

    const joinedPath = parts.slice(0, 2).join("/");
    const display = `${host}/${joinedPath}`;
    return shortenMiddle(display, 20, 12);
  } catch {
    return shortenMiddle(raw);
  }
}

export function formatAccountDisplayValue(provider: string, rawValue: string) {
  const value = rawValue.trim();
  if (!value || (provider === "wechat" && value === "__wechat_pending__")) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return normalizeUrlDisplay(value);
  }

  return shortenMiddle(value);
}
