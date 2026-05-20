const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export function parsePagination(query: Record<string, unknown>): { limit: number; offset: number; page: number } {
  const rawLimit = Number(query.limit);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  const rawPage = Number(query.page);
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const offset = (page - 1) * limit;

  return { limit, offset, page };
}
