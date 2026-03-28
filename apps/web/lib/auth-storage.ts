export type StoredAuth = {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  };
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
};

const STORAGE_KEY = "liquid-sale-auth";

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAuth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function saveStoredAuth(value: StoredAuth) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
