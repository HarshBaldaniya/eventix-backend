// Health repository contract - data access for health check
export interface IHealthRepository {
  checkDbConnection(): Promise<boolean>;
}
