import { lazy } from "react";
import Loadable from "app/components/Loadable";

const ProfilePage = Loadable(lazy(() => import("../account/ProfilePage")));
const ForcePasswordChangePage = Loadable(lazy(() => import("../account/ForcePasswordChangePage")));



const materialRoutes = [
  { path: "/account/profile", element: <ProfilePage /> },
  { path: "/account/change-password", element: <ForcePasswordChangePage /> },

];

export default materialRoutes;
