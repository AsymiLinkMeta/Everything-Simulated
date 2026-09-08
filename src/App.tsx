import { Navigate, Route, Routes } from "react-router-dom";
import { SiteShell } from "@/components/es/site-shell";
import { AppShell } from "@/components/es/app-shell";
import { StaffShell } from "@/components/es/staff-shell";
import { Home } from "@/routes/index";
import { Route as BuildsRoute } from "@/routes/_site/builds/index";
import { Route as BuildSlugRoute } from "@/routes/_site/builds/$slug";
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
import { Route as StaffTeamRoute } from "@/routes/staff/team";
import { Route as StaffCrmRoute } from "@/routes/staff/crm";
import { Route as StaffCrmIdRoute } from "@/routes/staff/crm-id";
import { Route as StaffOmsRoute } from "@/routes/staff/oms";
import { Route as StaffOmsIdRoute } from "@/routes/staff/oms-id";

function Page({ C }: { C: React.ComponentType }) {
  return (
    <SiteShell>
      <C />
    </SiteShell>
  );
}

export default function App() {
  const Builds = BuildsRoute.component!;
  const BuildSlug = BuildSlugRoute.component!;
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
  const AppIndex = AppIndexRoute.component!;
  const AppBuild = AppBuildRoute.component!;
  const AppChat = AppChatRoute.component!;
  const AppQuotes = AppQuotesRoute.component!;
  const AppBook = AppBookRoute.component!;
  const StaffIndex = StaffIndexRoute.component!;
  const StaffCatalog = StaffCatalogRoute.component!;
  const StaffQuotes = StaffQuotesRoute.component!;
  const StaffJobs = StaffJobsRoute.component!;
  const StaffBookings = StaffBookingsRoute.component!;
  const StaffTeam = StaffTeamRoute.component!;
  const StaffCrm = StaffCrmRoute.component!;
  const StaffCrmId = StaffCrmIdRoute.component!;
  const StaffOms = StaffOmsRoute.component!;
  const StaffOmsId = StaffOmsIdRoute.component!;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/builds" element={<Page C={Builds} />} />
      <Route path="/builds/:slug" element={<Page C={BuildSlug} />} />
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
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<AppIndex />} />
        <Route path="build" element={<AppBuild />} />
        <Route path="chat" element={<AppChat />} />
        <Route path="quotes" element={<AppQuotes />} />
        <Route path="book" element={<AppBook />} />
      </Route>
      <Route path="/staff" element={<StaffShell />}>
        <Route index element={<StaffIndex />} />
        <Route path="catalog" element={<StaffCatalog />} />
        <Route path="crm" element={<StaffCrm />} />
        <Route path="crm/:id" element={<StaffCrmId />} />
        <Route path="oms" element={<StaffOms />} />
        <Route path="oms/:id" element={<StaffOmsId />} />
        <Route path="quotes" element={<StaffQuotes />} />
        <Route path="jobs" element={<StaffJobs />} />
        <Route path="bookings" element={<StaffBookings />} />
        <Route path="team" element={<StaffTeam />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
