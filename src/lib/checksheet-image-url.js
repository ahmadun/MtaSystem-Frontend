export function resolveChecksheetImageSrc(value, apiEndpoint = import.meta.env.VITE_API_ENDPOINT) {
  if (!value) return "";

  if (typeof value === "object") {
    return resolveChecksheetImageSrc(value.url ?? value.relativeUrl ?? value.path ?? value.fileUrl, apiEndpoint);
  }

  const rawValue = String(value).trim().replace(/^["']|["']$/g, "");
  if (!rawValue) return "";

  if (rawValue.startsWith("{")) {
    try {
      return resolveChecksheetImageSrc(JSON.parse(rawValue), apiEndpoint);
    } catch {
      return "";
    }
  }

  if (/^(data:|blob:)/i.test(rawValue)) return rawValue;

  let path = rawValue.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}${url.hash}`;
      if (!/^\/(api\/)?uploads\//i.test(path)) return rawValue;
    } catch {
      return rawValue;
    }
  }

  path = path.replace(/^\/?api\/uploads\//i, "/uploads/");
  if (path.startsWith("uploads/")) path = `/${path}`;
  if (!path.startsWith("/uploads/")) return rawValue;

  const pageOrigin = globalThis.location?.origin ?? "http://localhost";
  const apiOrigin = new URL(apiEndpoint || pageOrigin, pageOrigin).origin;
  return new URL(path, apiOrigin).href;
}
