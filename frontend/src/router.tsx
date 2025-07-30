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
import { SwapPage } from "./pages/SwapPage";

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

const appSwapRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/swap",
  component: SwapPage,
});

const ThreeDGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/game",
  component: ThreePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  appRoute.addChildren([appDashboardRoute, appSwapRoute]),
  ThreeDGameRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
