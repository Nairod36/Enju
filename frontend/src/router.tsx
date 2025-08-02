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
import { IslandExplorer } from "./pages/app/IslandExplorer";
import { Rewards } from "./pages/app/Rewards";
import { Profile } from "./pages/app/Profile";
import DocumentationPage from "./pages/DocumentationPage";

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

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocumentationPage,
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

const explorerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/explorer",
  component: IslandExplorer,
});

const rewardsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rewards",
  component: Rewards,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/profile",
  component: Profile,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  docsRoute,
  appRoute.addChildren([
    appDashboardRoute,
    explorerRoute,
    rewardsRoute,
    profileRoute,
  ]),
  ThreeDGameRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
