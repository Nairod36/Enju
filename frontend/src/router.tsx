import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import HomePage from "./pages/HomePage";
import { AppPage } from "./pages/app/AppPage";
import { AppDashboard } from "./pages/app/AppDashboard";
import ThreePage from "./pages/app/ThreePage";
import { BridgePage } from "./pages/BridgePage";

const rootRoute = createRootRoute({
  component: () => (
    <main>
      <Outlet />
    </main>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: AppPage,
});

const appDashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: AppDashboard,
});

const ThreeDGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/game",
  component: ThreePage,
});

const bridgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bridge",
  component: BridgePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  appRoute.addChildren([appDashboardRoute]),
  ThreeDGameRoute,
  bridgeRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
