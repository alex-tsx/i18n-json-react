/** A small Suspense resource: deduplicates a request and retains its result or error. */
export interface AsyncResource<T> {
  promise: Promise<T>;
  read(): T;
  isRejected(): boolean;
}

export function createAsyncResource<T>(load: () => Promise<T>): AsyncResource<T> {
  let status: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  let result: T;
  let failure: unknown;
  const promise = Promise.resolve()
    .then(load)
    .then(
      value => {
        result = value;
        status = 'fulfilled';
        return value;
      },
      error => {
        failure = error;
        status = 'rejected';
        throw error;
      },
    );

  // React owns suspended promises, but an imperative prefetch may have no reader yet.
  // Handle the rejection on a separate branch; the public promise still rejects.
  void promise.catch(error => error);

  return {
    promise,
    read() {
      if (status === 'pending') throw promise;
      if (status === 'rejected') throw failure;
      return result;
    },
    isRejected: () => status === 'rejected',
  };
}
