import { Navigate, Route, Routes } from "react-router-dom";
import { SiteShell } from "@/components/es/site-shell";
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
      <Route path="/app/*" element={<Navigate to="/login" replace />} />
      <Route path="/staff/*" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
