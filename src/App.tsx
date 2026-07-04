import { useEffect, useState } from "react";
import "./styles/app.css";
import "./styles/pages.css";
import { ExportDialog } from "./components/ExportDialog";
import { FileDropzone } from "./components/FileDropzone";
import { SideNav } from "./components/SideNav";
import { TopBar } from "./components/TopBar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { BoxesPage } from "./pages/BoxesPage";
import { HexView } from "./pages/HexView";
import { ItemsPage } from "./pages/ItemsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PartyPage } from "./pages/PartyPage";
import { PokedexPage } from "./pages/PokedexPage";
import { TrainerPage } from "./pages/TrainerPage";
import { useNav } from "./state/nav";
import { useSaveStore } from "./state/store";

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
    case "hex":
      return <HexView />;
    default:
      return <OverviewPage />;
  }
}

export default function App() {
  useThemeClass();
  const fileName = useSaveStore((s) => s.fileName);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="app">
      <TopBar onExport={() => setExportOpen(true)} />
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
