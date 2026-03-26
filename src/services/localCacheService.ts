
export const localCacheService = {
  set: (key: string, value: any, ttlMinutes?: number) => {
    const item = {
      value,
      expiry: ttlMinutes ? Date.now() + ttlMinutes * 60 * 1000 : null,
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  get: (key: string) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    if (item.expiry && Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  },

  remove: (key: string) => {
    localStorage.removeItem(key);
  },

  clearExpired: () => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        localCacheService.get(key); // This will trigger removal if expired
      }
    }
  }
};
