import { useEffect, useState } from 'react';

import type { Repositories } from './repository';
import { useData } from './DataProvider';

/**
 * 读取数据的小工具：数据有变化（任何写入）或 deps 变化时自动重新读取。
 *
 *   const jobs = useQuery((repos) => repos.jobs.list(), []);
 */
export function useQuery<T>(
  load: (repos: Repositories) => Promise<T>,
  deps: readonly unknown[]
): { data: T | undefined; error: Error | undefined } {
  const { repos, dataVersion } = useData();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let cancelled = false;
    load(repos).then(
      (value) => {
        if (!cancelled) {
          setData(value);
          setError(undefined);
        }
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, dataVersion, ...deps]);

  return { data, error };
}
