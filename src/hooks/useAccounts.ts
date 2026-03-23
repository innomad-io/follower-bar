import { useEffect, useState } from "react";
import { listAccounts } from "../lib/commands";
import type { AccountWithStats } from "../types";

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading((current) => current && accounts.length === 0);
      const nextAccounts = await listAccounts();
      setAccounts(nextAccounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { accounts, error, loading, refresh };
}
