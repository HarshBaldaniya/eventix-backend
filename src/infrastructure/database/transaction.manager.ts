import { ITransactionManager } from '../../domain/interfaces/transaction.interface';
import { executeInTransaction as pgExecuteInTransaction } from './postgres.client';

/** PostgreSQL implementation of ITransactionManager. */
export class TransactionManager implements ITransactionManager {
  async executeInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
    return pgExecuteInTransaction(fn);
  }
}
