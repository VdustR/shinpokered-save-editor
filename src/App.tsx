import { useEffect, useState } from "react";
import "./styles/app.css";
import "./styles/pages.css";
import { AssessmentBanner } from "./components/AssessmentBanner";
import { ExportDialog } from "./components/ExportDialog";
import { FileDropzone } from "./components/FileDropzone";
import { SideNav } from "./components/SideNav";
import { TopBar } from "./components/TopBar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { BoxesPage } from "./pages/BoxesPage";
import { EncyclopediaPage } from "./pages/EncyclopediaPage";
import { FlagsPage } from "./pages/FlagsPage";
import { HallOfFamePage } from "./pages/HallOfFamePage";
import { HexView } from "./pages/HexView";
import { ItemsPage } from "./pages/ItemsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PartyPage } from "./pages/PartyPage";
import { PokedexPage } from "./pages/PokedexPage";
import { TestDrivePage } from "./pages/TestDrivePage";
import { TrainerPage } from "./pages/TrainerPage";
import { useNav } from "./state/nav";
import { useSaveStore } from "./state/store";

/**
 * Global Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z / Ctrl+Y (redo).
 * Skipped while an editable element has focus so native text editing
 * inside inputs keeps its own undo behavior.
 */
function useUndoRedoShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))
        return;
      // Leave the shortcut to the browser when there is nothing to do.
      const store = useSaveStore.getState();
      if (isUndo ? store.past.length === 0 : store.future.length === 0) return;
      e.preventDefault();
      if (isUndo) store.undo();
      else store.redo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function useThemeClass() {
  const theme = useSaveStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    if (theme === "light") root.classList.add("theme-light");
    else if (theme === "dark") root.classList.add("theme-dark");
  }, [theme]);
}

function ActivePage() {
  const page = useNav((s) => s.page);
  switch (page) {
    case "overview":
      return <OverviewPage />;
    case "trainer":
      return <TrainerPage />;
    case "party":
      return <PartyPage />;
    case "boxes":
      return <BoxesPage />;
    case "items":
      return <ItemsPage />;
    case "pokedex":
      return <PokedexPage />;
    case "flags":
      return <FlagsPage />;
    case "hof":
      return <HallOfFamePage />;
    case "encyclopedia":
      return <EncyclopediaPage />;
    case "testdrive":
      return <TestDrivePage />;
    case "hex":
      return <HexView />;
    default:
      return <OverviewPage />;
  }
}

export default function App() {
  useThemeClass();
  useUndoRedoShortcuts();
  const fileName = useSaveStore((s) => s.fileName);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="app">
      <TopBar onExport={() => setExportOpen(true)} />
      <AssessmentBanner />
      {fileName ? (
        <div className="app__body">
          <SideNav />
          <main className="app__main">
            <ActivePage />
          </main>
        </div>
      ) : (
        <div className="app__body app__body--empty">
          <FileDropzone />
        </div>
      )}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <UpdatePrompt />
    </div>
  );
}
