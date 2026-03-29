const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "hotnail.com": "hotmail.com",
  "yaho.com": "yahoo.com",
};

export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Enter a valid email (example: name@domain.com).";
  }

  const domain = trimmed.split("@")[1] ?? "";
  if (COMMON_DOMAIN_TYPOS[domain]) {
    return `Email domain looks incorrect. Did you mean @${COMMON_DOMAIN_TYPOS[domain]}?`;
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  return null;
}

export function getApiErrorMessage(error: any, fallback: string): string {
  if (error?.code === "ECONNABORTED") {
    return "Request timed out. Please check if backend server is running.";
  }

  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first?.msg && typeof first.msg === "string") {
      return first.msg;
    }
  }

  if (error?.message === "Network Error") {
    return "Cannot reach backend server. Verify API URL and backend status.";
  }

  return fallback;
}
