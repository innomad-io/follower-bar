import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AccountList } from "./components/AccountList";
import { Settings } from "./components/Settings";
import { AddAccount } from "./components/AddAccount";
import { AccountDetail } from "./components/AccountDetail";

type View = "list" | "settings" | "add-account" | "account-detail";
type MotionState = "idle" | "opening" | "closing";

export default function App() {
  const [view, setView] = useState<View>("list");
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let timer = 0;

    const setAnimatedState = (nextState: MotionState, durationMs: number) => {
      window.clearTimeout(timer);
      setMotionState(nextState);

      timer = window.setTimeout(() => {
        setMotionState("idle");
      }, durationMs);
    };

    const setupListeners = async () => {
      const stopOpened = await currentWindow.listen("followbar://opened", () => {
        setAnimatedState("opening", 180);
      });

      const stopClosing = await currentWindow.listen("followbar://closing", () => {
        setAnimatedState("closing", 120);
      });

      const stopFocus = await currentWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          setAnimatedState("opening", 180);
        }
      });

      return () => {
        stopOpened();
        stopClosing();
        stopFocus();
      };
    };

    const cleanupPromise = setupListeners();

    return () => {
      window.clearTimeout(timer);
      void cleanupPromise.then((cleanup) => cleanup());
    };
  }, []);

  return (
    <main
      className={`app-shell flex h-screen w-screen items-start justify-center overflow-hidden px-7 pb-7 pt-0 text-slate-900 ${
        motionState === "opening"
          ? "window-opening"
          : motionState === "closing"
            ? "window-closing"
            : ""
      }`}
    >
      <div className="popover-panel h-[504px] w-[376px] overflow-hidden rounded-[10px]">
        {view === "list" ? (
          <AccountList
            onOpenSettings={() => setView("settings")}
            onOpenAddAccount={() => setView("add-account")}
            onOpenAccount={(accountId) => {
              setSelectedAccountId(accountId);
              setView("account-detail");
            }}
          />
        ) : null}

        {view === "settings" ? (
          <Settings onBack={() => setView("list")} />
        ) : null}

        {view === "add-account" ? (
          <AddAccount
            onCancel={() => setView("list")}
            onAdded={(accountId) => {
              setSelectedAccountId(accountId);
              setView("list");
            }}
          />
        ) : null}

        {view === "account-detail" && selectedAccountId ? (
          <AccountDetail
            accountId={selectedAccountId}
            onBack={() => setView("list")}
          />
        ) : null}
      </div>
    </main>
  );
}
