import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { SiteShell } from "@/components/es/site-shell";
import { AppShell } from "@/components/es/app-shell";
import { StaffShell } from "@/components/es/staff-shell";
import { RouteError } from "@/components/es/route-error";
import { NotFoundPage } from "@/routes/not-found";
import { Route as HomeRoute } from "@/routes/index";
import { Route as ShopRoute } from "@/routes/_site/shop/index";
import { Route as ShopSkuRoute } from "@/routes/_site/shop/$sku";
import { Route as CompatRoute } from "@/routes/_site/compatibility";
import { Route as StudioRoute } from "@/routes/_site/studio";
import { Route as GuidesRoute } from "@/routes/_site/guides/index";
import { Route as GuideSlugRoute } from "@/routes/_site/guides/$slug";
import { Route as AuRoute } from "@/routes/_site/au/index";
import { Route as CityRoute } from "@/routes/_site/au/$city";
import { Route as ContactRoute } from "@/routes/_site/contact";
import { Route as PrivacyRoute } from "@/routes/_site/privacy";
import { Route as TermsRoute } from "@/routes/_site/terms";
import { Route as LoginRoute } from "@/routes/login";
import { Route as FaqsRoute } from "@/routes/_site/faqs";
import { Route as CheckoutRoute } from "@/routes/_site/checkout";
import { Route as AppOrdersRoute } from "@/routes/app/orders";
import { Route as StaffRulesRoute } from "@/routes/staff/rules";
import { Route as AppIndexRoute } from "@/routes/app/index";
import { Route as AppBuildRoute } from "@/routes/app/build";
import { Route as AppChatRoute } from "@/routes/app/chat";
import { Route as AppQuotesRoute } from "@/routes/app/quotes";
import { Route as AppBookRoute } from "@/routes/app/book";
import { Route as StaffIndexRoute } from "@/routes/staff/index";
import { Route as StaffCatalogRoute } from "@/routes/staff/catalog";
import { Route as StaffQuotesRoute } from "@/routes/staff/quotes";
import { Route as StaffJobsRoute } from "@/routes/staff/jobs";
import { Route as StaffBookingsRoute } from "@/routes/staff/bookings";
import { Route as StaffBrandsRoute } from "@/routes/staff/brands";
import { Route as StaffTeamRoute } from "@/routes/staff/team";
import { Route as StaffCrmRoute } from "@/routes/staff/crm";
import { Route as StaffCrmIdRoute } from "@/routes/staff/crm-id";
import { Route as StaffOmsRoute } from "@/routes/staff/oms";
import { Route as StaffOmsIdRoute } from "@/routes/staff/oms-id";
import { Route as StaffPrebuildsRoute } from "@/routes/staff/prebuilds";
import { Route as PrebuildsRoute } from "@/routes/_site/prebuilds/index";
import { Route as PrebuildSlugRoute } from "@/routes/_site/prebuilds/$slug";
import { Route as OrderRoute } from "@/routes/_site/order";
import { Route as AppServiceRoute } from "@/routes/app/service";
import { Route as StaffServiceRoute } from "@/routes/staff/service";
import { Route as StaffAgentRoute } from "@/routes/staff/agent";
import { Route as RacingRoute } from "@/routes/_site/racing";
import { Route as AircraftRoute } from "@/routes/_site/aircraft/index";
import { Route as HelicopterRoute } from "@/routes/_site/aircraft/helicopter";
import { Route as FlightRoute } from "@/routes/_site/aircraft/flight";
import { Route as DronesRoute } from "@/routes/_site/drones";
import { Route as TrainingRoute } from "@/routes/_site/training/index";
import { Route as DriverTrainingRoute } from "@/routes/_site/training/driver";
import { Route as IndustrialTrainingRoute } from "@/routes/_site/training/industrial";
import { Route as DriversRoute } from "@/routes/_site/drivers";
import { Route as PartnersRoute } from "@/routes/_site/partners";

function Page({ C }: { C: React.ComponentType }) {
  return (
    <SiteShell>
      <C />
    </SiteShell>
  );
}

function BuildsToPrebuilds() {
  const { slug } = useParams();
  return <Navigate to={`/prebuilds/${slug ?? ""}`} replace />;
}

export default function App() {
  const Home = HomeRoute.component!;
  const Shop = ShopRoute.component!;
  const ShopSku = ShopSkuRoute.component!;
  const Compat = CompatRoute.component!;
  const Studio = StudioRoute.component!;
  const Guides = GuidesRoute.component!;
  const GuideSlug = GuideSlugRoute.component!;
  const Au = AuRoute.component!;
  const City = CityRoute.component!;
  const Contact = ContactRoute.component!;
  const Privacy = PrivacyRoute.component!;
  const Terms = TermsRoute.component!;
  const Login = LoginRoute.component!;
  const Faqs = FaqsRoute.component!;
  const Checkout = CheckoutRoute.component!;
  const AppIndex = AppIndexRoute.component!;
  const AppBuild = AppBuildRoute.component!;
  const AppChat = AppChatRoute.component!;
  const AppQuotes = AppQuotesRoute.component!;
  const AppBook = AppBookRoute.component!;
  const AppOrders = AppOrdersRoute.component!;
  const StaffIndex = StaffIndexRoute.component!;
  const StaffCatalog = StaffCatalogRoute.component!;
  const StaffQuotes = StaffQuotesRoute.component!;
  const StaffJobs = StaffJobsRoute.component!;
  const StaffBookings = StaffBookingsRoute.component!;
  const StaffBrands = StaffBrandsRoute.component!;
  const StaffTeam = StaffTeamRoute.component!;
  const StaffCrm = StaffCrmRoute.component!;
  const StaffCrmId = StaffCrmIdRoute.component!;
  const StaffOms = StaffOmsRoute.component!;
  const StaffOmsId = StaffOmsIdRoute.component!;
  const StaffRules = StaffRulesRoute.component!;
  const StaffPrebuilds = StaffPrebuildsRoute.component!;
  const Prebuilds = PrebuildsRoute.component!;
  const PrebuildSlug = PrebuildSlugRoute.component!;
  const OrderLookup = OrderRoute.component!;
  const AppService = AppServiceRoute.component!;
  const StaffService = StaffServiceRoute.component!;
  const StaffAgent = StaffAgentRoute.component!;
  const Racing = RacingRoute.component!;
  const Aircraft = AircraftRoute.component!;
  const Helicopter = HelicopterRoute.component!;
  const Flight = FlightRoute.component!;
  const Drones = DronesRoute.component!;
  const Training = TrainingRoute.component!;
  const DriverTraining = DriverTrainingRoute.component!;
  const IndustrialTraining = IndustrialTrainingRoute.component!;
  const Drivers = DriversRoute.component!;
  const Partners = PartnersRoute.component!;

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
      <Route path="/drivers" element={<Page C={Drivers} />} />
      <Route path="/partners" element={<Page C={Partners} />} />
      <Route path="/builds" element={<Navigate to="/prebuilds" replace />} />
      <Route path="/builds/:slug" element={<BuildsToPrebuilds />} />
      <Route path="/shop" element={<Page C={Shop} />} />
      <Route path="/shop/:sku" element={<Page C={ShopSku} />} />
      <Route path="/compatibility" element={<Page C={Compat} />} />
      <Route path="/studio" element={<Page C={Studio} />} />
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
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<AppIndex />} />
        <Route path="build" element={<AppBuild />} />
        <Route path="chat" element={<AppChat />} />
        <Route path="quotes" element={<AppQuotes />} />
        <Route path="orders" element={<AppOrders />} />
        <Route path="service" element={<AppService />} />
        <Route path="book" element={<AppBook />} />
      </Route>
      <Route path="/staff" element={<StaffShell />}>
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
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </RouteError>
  );
}
