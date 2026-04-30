const TOKEN_KEY = 'token';

export const getAuthToken = () => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) return token;

  // Remove legacy persistent tokens so future sessions do not keep bearer tokens at rest.
  localStorage.removeItem(TOKEN_KEY);
  return null;
};

export const setAuthToken = (token: string) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};
