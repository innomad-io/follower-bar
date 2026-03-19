import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AccountList } from "./components/AccountList";
import { Settings } from "./components/Settings";

type View = "list" | "settings";
type MotionState = "idle" | "opening" | "closing";

export default function App() {
  const [view, setView] = useState<View>("list");
  const [motionState, setMotionState] = useState<MotionState>("idle");

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
      <div className="popover-panel h-[420px] w-[376px] overflow-hidden rounded-[20px]">
        {view === "list" ? (
          <AccountList onOpenSettings={() => setView("settings")} />
        ) : (
          <Settings onBack={() => setView("list")} />
        )}
      </div>
    </main>
  );
}
