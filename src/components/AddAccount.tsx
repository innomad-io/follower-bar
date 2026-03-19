import { useEffect, useMemo, useState } from "react";
import { addAccount, getAvailableProviders } from "../lib/commands";
import type { ProviderInfo } from "../types";

interface AddAccountProps {
  onAdded: () => void;
  onCancel: () => void;
}

export function AddAccount({ onAdded, onCancel }: AddAccountProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAvailableProviders()
      .then((availableProviders) => {
        setProviders(availableProviders);
        const firstSupported = availableProviders.find((item) => !item.coming_soon);
        if (firstSupported) {
          setProvider(firstSupported.id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === provider) ?? null,
    [provider, providers]
  );

  const handleSubmit = async () => {
    if (!provider || !username.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await addAccount(provider, username.trim());
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const placeholder =
    selectedProvider?.id === "youtube"
      ? "@channelhandle or youtube.com/@channelhandle"
      : selectedProvider?.id === "bilibili"
        ? "UID, nickname, or space.bilibili.com/... URL"
        : selectedProvider?.id === "x"
          ? "@username or x.com/username"
          : "Handle, username, or profile URL";

  return (
    <section className="panel-section rounded-[24px] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Add account</h3>
        <p className="mt-1 text-xs title-muted">
          Add a public handle or profile URL. FollowBar will resolve the official nickname when possible.
        </p>
      </div>

      <div className="space-y-3">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          className="soft-input w-full rounded-2xl px-3 py-2.5 text-sm"
        >
          {providers.map((item) => (
            <option key={item.id} value={item.id} disabled={item.coming_soon}>
              {item.name}{item.coming_soon ? " (Coming Soon)" : ""}
            </option>
          ))}
        </select>

        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          className="soft-input w-full rounded-2xl px-3 py-2.5 text-sm"
        />

        {selectedProvider?.needs_api_key ? (
          <p className="text-xs text-fuchsia-500">
            {selectedProvider.id === "x"
              ? "A bearer token is optional. If it is missing, FollowBar will fall back to the public X profile page."
              : "An API key is optional. If it is missing, FollowBar will fall back to the public profile page when possible."}
          </p>
        ) : null}

        {error ? <p className="text-xs text-rose-500">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !provider || !username.trim()}
            className="accent-button flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add account"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="subtle-button rounded-2xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
