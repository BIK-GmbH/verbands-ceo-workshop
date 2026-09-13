import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkshopLayout } from "@/components/WorkshopLayout";
import { Slide } from "@/routes/Slide";
import { Print } from "@/routes/Print";
import { Presentation } from "@/routes/Presentation";
import { Protocol } from "@/routes/Protocol";
import { Landing } from "@/routes/Landing";
import { Interviews } from "@/routes/Interviews";
import { Poster } from "@/routes/Poster";
import { Settings } from "@/routes/Settings";
import { SystemCheckPage } from "@/routes/SystemCheckPage";
import { HelpProvider, HelpRoute, HELP_PATH } from "@/lib/help";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { MotionProvider } from "@/lib/motion";
import { FontScaleProvider } from "@/lib/font-scale";
import { LoginGate } from "@/components/LoginGate";
import { AutoBackup } from "@/components/AutoBackup";

export function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <FontScaleProvider>
          <MotionProvider>
            <LoginGate>
              <HashRouter>
                <AutoBackup />
                <HelpProvider>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route element={<WorkshopLayout />}>
                      <Route path="/s/:slideId" element={<Slide />} />
                    </Route>
                    <Route path="/p/:slideId" element={<Presentation />} />
                    <Route path="/print" element={<Print />} />
                    <Route path="/protokoll" element={<Protocol />} />
                    <Route path="/interviews" element={<Interviews />} />
                    <Route path="/einstellungen" element={<Settings />} />
                    <Route path="/systemcheck" element={<SystemCheckPage />} />
                    <Route path="/poster" element={<Poster />} />
                    <Route path="/poster/:phase" element={<Poster />} />
                    <Route path={HELP_PATH} element={<HelpRoute />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </HelpProvider>
              </HashRouter>
            </LoginGate>
          </MotionProvider>
        </FontScaleProvider>
      </ThemeProvider>
    </LangProvider>
  );
}
