import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkshopLayout } from "@/components/WorkshopLayout";
import { Slide } from "@/routes/Slide";
import { Print } from "@/routes/Print";
import { Presentation } from "@/routes/Presentation";
import { Protocol } from "@/routes/Protocol";
import { ALL_SLIDES } from "@/lib/slides";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { MotionProvider } from "@/lib/motion";

const FIRST = ALL_SLIDES[0].id;

export function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <MotionProvider>
          <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to={`/s/${FIRST}`} replace />} />
            <Route element={<WorkshopLayout />}>
              <Route path="/s/:slideId" element={<Slide />} />
            </Route>
            <Route path="/p/:slideId" element={<Presentation />} />
            <Route path="/print" element={<Print />} />
            <Route path="/protokoll" element={<Protocol />} />
            <Route path="*" element={<Navigate to={`/s/${FIRST}`} replace />} />
            </Routes>
          </HashRouter>
        </MotionProvider>
      </ThemeProvider>
    </LangProvider>
  );
}
