/** Transaction manager - abstracts DB transaction execution. Application layer depends on this, not on infrastructure. */
export interface ITransactionManager {
  executeInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T>;
}
