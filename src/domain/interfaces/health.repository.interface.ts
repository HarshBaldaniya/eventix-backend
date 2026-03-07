// Health repository contract - data access for health check
export interface IHealthRepository {
  checkDb(): Promise<boolean>;
  checkRedis(): Promise<boolean>;
}
