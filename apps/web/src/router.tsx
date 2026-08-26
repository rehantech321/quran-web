import { createBrowserRouter } from "react-router-dom";

import { KitchenSink } from "@/pages/dev/KitchenSink";
import { Home } from "@/pages/Home";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/dev/kitchen-sink", element: <KitchenSink /> },
]);
