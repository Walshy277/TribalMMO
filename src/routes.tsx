import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { WorkPage } from "./pages/WorkPage";
import { TrainingPage } from "./pages/TrainingPage";
import { SkillsPage } from "./pages/SkillsPage";
import { CraftingPage } from "./pages/CraftingPage";
import { ExplorePage } from "./pages/ExplorePage";
import { VillagePage } from "./pages/VillagePage";
import { SquarePage } from "./pages/SquarePage";
import { GreatFirePage } from "./pages/GreatFirePage";
import { ShopPage } from "./pages/ShopPage";
import { ArmoryPage } from "./pages/ArmoryPage";
import { FoodShopPage } from "./pages/FoodShopPage";
import { GeneralStorePage } from "./pages/GeneralStorePage";
import { PetShopPage } from "./pages/PetShopPage";
import { PostOfficePage } from "./pages/PostOfficePage";
import { NoticeBoardPage } from "./pages/NoticeBoardPage";
import { BagPage } from "./pages/BagPage";
import { ClanPage } from "./pages/ClanPage";
import { ClansDirectoryPage } from "./pages/ClansDirectoryPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PATHS } from "./lib/paths";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);

export const routes: RouteObject[] = [
  {
    path: PATHS.login,
    element: <LoginPage />,
  },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to={PATHS.home} replace /> },
      { path: PATHS.home, element: <HomePage /> },
      { path: PATHS.work, element: <WorkPage /> },
      { path: PATHS.train, element: <TrainingPage /> },
      { path: PATHS.skills, element: <SkillsPage /> },
      { path: PATHS.craft, element: <CraftingPage /> },
      { path: PATHS.explore, element: <ExplorePage /> },
      { path: PATHS.village, element: <VillagePage /> },
      { path: PATHS.villageFire, element: <GreatFirePage /> },
      { path: PATHS.villageSquare, element: <SquarePage /> },
      { path: PATHS.villageMarket, element: <ShopPage /> },
      { path: PATHS.villageArmory, element: <ArmoryPage /> },
      { path: PATHS.villagePets, element: <PetShopPage /> },
      { path: PATHS.villageFood, element: <FoodShopPage /> },
      { path: PATHS.villageGeneral, element: <GeneralStorePage /> },
      { path: PATHS.villagePost, element: <PostOfficePage /> },
      { path: PATHS.villageNotices, element: <NoticeBoardPage /> },
      { path: PATHS.bag, element: <BagPage /> },
      { path: PATHS.clan, element: <ClanPage /> },
      { path: PATHS.clans, element: <ClansDirectoryPage /> },
      { path: PATHS.profile, element: <PublicProfilePage /> },
      { path: PATHS.admin, element: <AdminPage /> },

      // Legacy /shop/* redirects
      { path: PATHS.shop, element: <Navigate to={PATHS.villageMarket} replace /> },
      { path: PATHS.shopArmory, element: <Navigate to={PATHS.villageArmory} replace /> },
      { path: PATHS.shopGeneral, element: <Navigate to={PATHS.villageGeneral} replace /> },
      { path: PATHS.shopFood, element: <Navigate to={PATHS.villageFood} replace /> },
      { path: PATHS.shopPets, element: <Navigate to={PATHS.villagePets} replace /> },
      { path: PATHS.shopPost, element: <Navigate to={PATHS.villagePost} replace /> },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
