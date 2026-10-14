import { lazy, Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { SiteShell } from "@/components/es/site-shell";
import { RouteError } from "@/components/es/route-error";
import { NotFoundPage } from "@/routes/not-found";
import { Route as HomeRoute } from "@/routes/index";

type RouteModule = { Route: { component?: ComponentType } };

function lazyRoute(load: () => Promise<RouteModule>) {
  return lazy(async () => {
    const mod = await load();
    const C = mod.Route.component;
    if (!C) throw new Error("Route module has no component");
    return { default: C };
  });
}

function PortalLoading() {
  return (
    <div className="es-portal-loading" role="status" aria-live="polite" style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "#a1a1aa" }}>
      Loading…
    </div>
  );
}



// Public pages load on demand too; only the home page ships in the entry chunk.
const Shop = lazyRoute(() => import("@/routes/_site/shop/index"));
const ShopSku = lazyRoute(() => import("@/routes/_site/shop/$sku"));
const Compat = lazyRoute(() => import("@/routes/_site/compatibility"));
const Studio = lazyRoute(() => import("@/routes/_site/studio"));
const Events = lazyRoute(() => import("@/routes/_site/events"));
const Guides = lazyRoute(() => import("@/routes/_site/guides/index"));
const GuideSlug = lazyRoute(() => import("@/routes/_site/guides/$slug"));
const Au = lazyRoute(() => import("@/routes/_site/au/index"));
const City = lazyRoute(() => import("@/routes/_site/au/$city"));
const Contact = lazyRoute(() => import("@/routes/_site/contact"));
const Privacy = lazyRoute(() => import("@/routes/_site/privacy"));
const Terms = lazyRoute(() => import("@/routes/_site/terms"));
const Login = lazyRoute(() => import("@/routes/login"));
const Faqs = lazyRoute(() => import("@/routes/_site/faqs"));
const Checkout = lazyRoute(() => import("@/routes/_site/checkout"));
const Prebuilds = lazyRoute(() => import("@/routes/_site/prebuilds/index"));
const PrebuildSlug = lazyRoute(() => import("@/routes/_site/prebuilds/$slug"));
const OrderLookup = lazyRoute(() => import("@/routes/_site/order"));
const Racing = lazyRoute(() => import("@/routes/_site/racing"));
const Aircraft = lazyRoute(() => import("@/routes/_site/aircraft/index"));
const Helicopter = lazyRoute(() => import("@/routes/_site/aircraft/helicopter"));
const Flight = lazyRoute(() => import("@/routes/_site/aircraft/flight"));
const Drones = lazyRoute(() => import("@/routes/_site/drones"));
const Training = lazyRoute(() => import("@/routes/_site/training/index"));
const DriverTraining = lazyRoute(() => import("@/routes/_site/training/driver"));
const IndustrialTraining = lazyRoute(() => import("@/routes/_site/training/industrial"));
const Drivers = lazyRoute(() => import("@/routes/_site/drivers"));
const AmbassadorProfile = lazyRoute(() => import("@/routes/_site/ambassador-profile"));
const Partners = lazyRoute(() => import("@/routes/_site/partners"));

// /app and /staff are split into their own chunks: public visitors never download them.
const AppOrders = lazyRoute(() => import("@/routes/app/orders"));
const StaffRules = lazyRoute(() => import("@/routes/staff/rules"));
const AppIndex = lazyRoute(() => import("@/routes/app/index"));
const AppBuild = lazyRoute(() => import("@/routes/app/build"));
const AppChat = lazyRoute(() => import("@/routes/app/chat"));
const AppQuotes = lazyRoute(() => import("@/routes/app/quotes"));
const AppBook = lazyRoute(() => import("@/routes/app/book"));
const StaffIndex = lazyRoute(() => import("@/routes/staff/index"));
const StaffCatalog = lazyRoute(() => import("@/routes/staff/catalog"));
const StaffQuotes = lazyRoute(() => import("@/routes/staff/quotes"));
const StaffJobs = lazyRoute(() => import("@/routes/staff/jobs"));
const StaffBookings = lazyRoute(() => import("@/routes/staff/bookings"));
const StaffBrands = lazyRoute(() => import("@/routes/staff/brands"));
const StaffTeam = lazyRoute(() => import("@/routes/staff/team"));
const StaffCrm = lazyRoute(() => import("@/routes/staff/crm"));
const StaffCrmId = lazyRoute(() => import("@/routes/staff/crm-id"));
const StaffOms = lazyRoute(() => import("@/routes/staff/oms"));
const StaffOmsId = lazyRoute(() => import("@/routes/staff/oms-id"));
const StaffPrebuilds = lazyRoute(() => import("@/routes/staff/prebuilds"));
const AppService = lazyRoute(() => import("@/routes/app/service"));
const StaffService = lazyRoute(() => import("@/routes/staff/service"));
const StaffAgent = lazyRoute(() => import("@/routes/staff/agent"));
const AppAmbassador = lazyRoute(() => import("@/routes/app/ambassador"));
const StaffAmbassadors = lazyRoute(() => import("@/routes/staff/ambassadors"));
const AppShell = lazy(() => import("@/components/es/app-shell").then((m) => ({ default: m.AppShell })));
const StaffShell = lazy(() => import("@/components/es/staff-shell").then((m) => ({ default: m.StaffShell })));

function Page({ C }: { C: ComponentType }) {
  return (
    <SiteShell>
      <Suspense fallback={<PortalLoading />}>
        <C />
      </Suspense>
    </SiteShell>
  );
}

function BuildsToPrebuilds() {
  const { slug } = useParams();
  return <Navigate to={`/prebuilds/${slug ?? ""}`} replace />;
}

export default function App() {
  const Home = HomeRoute.component!;

  return (
    <RouteError>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/racing" element={<Page C={Racing} />} />
      <Route path="/racing/prebuilds" element={<Navigate to="/prebuilds" replace />} />
      <Route path="/racing/shop" element={<Navigate to="/shop" replace />} />
      <Route path="/racing/checker" element={<Navigate to="/compatibility" replace />} />
      <Route path="/aircraft" element={<Page C={Aircraft} />} />
      <Route path="/aircraft/helicopter" element={<Page C={Helicopter} />} />
      <Route path="/aircraft/flight" element={<Page C={Flight} />} />
      <Route path="/drones" element={<Page C={Drones} />} />
      <Route path="/training" element={<Page C={Training} />} />
      <Route path="/training/driver" element={<Page C={DriverTraining} />} />
      <Route path="/training/industrial" element={<Page C={IndustrialTraining} />} />
      <Route path="/ambassadors" element={<Page C={Drivers} />} />
      <Route path="/ambassadors/:slug" element={<Page C={AmbassadorProfile} />} />
      <Route path="/drivers" element={<Navigate to="/ambassadors" replace />} />
      <Route path="/partners" element={<Page C={Partners} />} />
      <Route path="/builds" element={<Navigate to="/prebuilds" replace />} />
      <Route path="/builds/:slug" element={<BuildsToPrebuilds />} />
      <Route path="/shop" element={<Page C={Shop} />} />
      <Route path="/shop/:sku" element={<Page C={ShopSku} />} />
      <Route path="/compatibility" element={<Page C={Compat} />} />
      <Route path="/studio" element={<Page C={Studio} />} />
      <Route path="/events" element={<Page C={Events} />} />
      <Route path="/catering" element={<Navigate to="/events" replace />} />
      <Route path="/guides" element={<Page C={Guides} />} />
      <Route path="/guides/:slug" element={<Page C={GuideSlug} />} />
      <Route path="/au" element={<Page C={Au} />} />
      <Route path="/au/:city" element={<Page C={City} />} />
      <Route path="/contact" element={<Page C={Contact} />} />
      <Route path="/privacy" element={<Page C={Privacy} />} />
      <Route path="/terms" element={<Page C={Terms} />} />
      <Route path="/faqs" element={<Page C={Faqs} />} />
      <Route path="/checkout" element={<Page C={Checkout} />} />
      <Route path="/order" element={<Page C={OrderLookup} />} />
      <Route path="/prebuilds" element={<Page C={Prebuilds} />} />
      <Route path="/prebuilds/:slug" element={<Page C={PrebuildSlug} />} />
      <Route
        path="/login"
        element={
          <Suspense fallback={<PortalLoading />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/app"
        element={
          <Suspense fallback={<PortalLoading />}>
            <AppShell />
          </Suspense>
        }
      >
        <Route index element={<AppIndex />} />
        <Route path="build" element={<AppBuild />} />
        <Route path="chat" element={<AppChat />} />
        <Route path="quotes" element={<AppQuotes />} />
        <Route path="orders" element={<AppOrders />} />
        <Route path="service" element={<AppService />} />
        <Route path="book" element={<AppBook />} />
        <Route path="ambassador" element={<AppAmbassador />} />
      </Route>
      <Route
        path="/staff"
        element={
          <Suspense fallback={<PortalLoading />}>
            <StaffShell />
          </Suspense>
        }
      >
        <Route index element={<StaffIndex />} />
        <Route path="catalog" element={<StaffCatalog />} />
        <Route path="rules" element={<StaffRules />} />
        <Route path="crm" element={<StaffCrm />} />
        <Route path="crm/:id" element={<StaffCrmId />} />
        <Route path="oms" element={<StaffOms />} />
        <Route path="oms/:id" element={<StaffOmsId />} />
        <Route path="quotes" element={<StaffQuotes />} />
        <Route path="jobs" element={<StaffJobs />} />
        <Route path="bookings" element={<StaffBookings />} />
        <Route path="brands" element={<StaffBrands />} />
        <Route path="team" element={<StaffTeam />} />
        <Route path="prebuilds" element={<StaffPrebuilds />} />
        <Route path="service" element={<StaffService />} />
        <Route path="agent" element={<StaffAgent />} />
        <Route path="ambassadors" element={<StaffAmbassadors />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </RouteError>
  );
}
