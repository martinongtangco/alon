export const apiService = {
  async ping(): Promise<{ ok: boolean; mode: 'mock' }> {
    return { ok: true, mode: 'mock' };
  },
};
