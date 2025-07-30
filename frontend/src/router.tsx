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
import LocalForkHelper from "./components/dev/LocalForkHelper";

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

const devForkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev/fork",
  component: LocalForkHelper,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  appRoute.addChildren([appDashboardRoute, appSwapRoute]),
  ThreeDGameRoute,
  devForkRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
