
const tokenBlack = new Map(); // token -> expiresAt(ms)

export const addToBlacklist = (token, expUnixSeconds) => {
  const expiresAtMs = expUnixSeconds * 1000;
  tokenBlack.set(token, expiresAtMs);

  const delay = Math.max(0, expiresAtMs - Date.now());
  setTimeout(() => tokenBlack.delete(token), delay);
};

export const isTokenBlacklisted = (token) => {
  const ts = tokenBlack.get(token);
  if (!ts) return false;
  if (Date.now() > ts) {
    tokenBlack.delete(token);
    return false;
  }
  return true;
};

export default tokenBlack;
