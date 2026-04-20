// In-memory access token store.
// The raw access token is never written to localStorage or sessionStorage.
// On page reload, the token is gone — AuthContext restores it via the refresh cookie.

let _accessToken = null;

export const getToken   = ()  => _accessToken;
export const setToken   = (t) => { _accessToken = t; };
export const clearToken = ()  => { _accessToken = null; };
