const STORAGE_KEYS_TO_CLEAR = [
  "jwtToken",
  "userInfo",
];

const parseStoredValue = (value: string | null) => {
  if (value === null) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const readFromStorage = (key: string) => {
  if (typeof window === "undefined") return null;

  const localValue = parseStoredValue(window.localStorage?.getItem(key) ?? null);
  if (localValue !== null) return localValue;

  const sessionValue = parseStoredValue(window.sessionStorage?.getItem(key) ?? null);
  if (sessionValue !== null) return sessionValue;

  return readFromCookie(key);
};

const readFromCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [k, ...rest] = cookie.split("=");
    if (k.trim() === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
};

export const prefixPluginTranslations = (
  translations: Record<string, string>,
  pluginId: string
) =>
  Object.keys(translations).reduce<Record<string, string>>((acc, key) => {
    acc[`${pluginId}.${key}`] = translations[key];
    return acc;
  }, {});

export const getBackendURL = () => {
  if (typeof window !== "undefined") {
    const runtimeBackendURL = (window as any)?.strapi?.backendURL;
    if (runtimeBackendURL) return runtimeBackendURL;
  }

  return process.env.STRAPI_ADMIN_BACKEND_URL || "";
};

export const getAdminToken = () => {
  const token = readFromStorage("jwtToken");
  return typeof token === "string" ? token : null;
};

export const clearAdminAuthStorage = () => {
  if (typeof window === "undefined") return;

  STORAGE_KEYS_TO_CLEAR.forEach((key) => {
    window.localStorage?.removeItem(key);
    window.sessionStorage?.removeItem(key);
  });
};
