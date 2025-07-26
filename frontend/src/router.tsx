import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import { Header } from "./components/headers/Header";
import HomePage from "./pages/HomePage";
import { TransitionPage } from "./pages/TransitionPage";
import { AppPage } from "./pages/app/AppPage";
import { AppDashboard } from "./pages/app/AppDashboard";
import ThreePage from "./pages/app/ThreePage";

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

const transitionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/transition",
  component: TransitionPage,
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
  path: "/game",
  component: ThreePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  transitionRoute,
  appRoute.addChildren([appDashboardRoute]),
  ThreeDGameRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
