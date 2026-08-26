import { RouterProvider } from "react-router-dom";

import { OfflineBanner } from "@/components/OfflineBanner";
import { ToastProvider } from "@/components/ui";
import { router } from "@/router";

function App() {
  return (
    <ToastProvider>
      <OfflineBanner />
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

export default App;
