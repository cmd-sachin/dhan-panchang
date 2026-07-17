import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import App from "./App";
import { I18nProvider } from "./i18n";
import { EnterpriseProvider } from "./store/useEnterprise";
import { TooltipProvider } from "@/components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <EnterpriseProvider>
        <TooltipProvider delayDuration={200}>
          <App />
        </TooltipProvider>
      </EnterpriseProvider>
    </I18nProvider>
  </StrictMode>,
);
