declare const paginationService: {
  getTaskList: (
    filters: any,
    options: { page: number; limit: number }
  ) => Promise<{ data: any[]; pageInfo: any }>;
  searchTasks: (
    searchTerm: string,
    options: { page: number; limit: number; where?: any }
  ) => Promise<{ data: any[]; pageInfo: any }>;
  analyzeQuery: (
    table: string,
    where: any,
    orderBy: Array<{ column: string; direction: 'asc' | 'desc' }>
  ) => Promise<{ sql: string; bindings: any[]; explain: any }>;
};
export default paginationService;
