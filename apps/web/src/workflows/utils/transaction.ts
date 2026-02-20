import { AsyncLocalStorage } from "node:async_hooks";
import { type DbTransaction, db } from "@acme/db/client";

const transactionStorage = new AsyncLocalStorage<DbTransaction>();

/**
 * Runs work inside a shared transaction scope.
 * Reuses an existing transaction when one is already active.
 */
export async function createTransaction<T>(
  work: (transaction: DbTransaction) => Promise<T>,
): Promise<T> {
  const currentTransaction = getTransaction();

  if (currentTransaction) {
    return work(currentTransaction);
  }

  return db.transaction(async (transaction) => {
    return transactionStorage.run(transaction, async () => {
      return work(transaction);
    });
  });
}

/**
 * Returns the current transaction from async scope, if present.
 */
export function getTransaction(): DbTransaction | undefined {
  return transactionStorage.getStore();
}
