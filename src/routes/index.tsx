import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gauge, MapPin, ShieldCheck, Wrench } from "lucide-react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, LoadError } from "@/components/es/bits";
import { TrustBar } from "@/components/es/trust-bar";
import { RigCard, RigCardSkeleton } from "@/components/es/rig-card";
import { PersonPhoto } from "@/components/es/person-photo";
import { SiteImage, rigSrcSet } from "@/components/es/site-image";
import { BRAND } from "@/lib/es/catalog";
import { graphLd, localBusinessLd, organizationLd, pageHead, websiteLd, faqLd, FAQS } from "@/lib/es/seo";
import { fetchFeaturedPrebuilds } from "@/lib/es/prebuilds";
import { ambassadorProfilePath, fetchAmbassadors } from "@/lib/es/ambassadors";
import { STAGE_IMAGES, STAGE_IMAGES_MOBILE, MOBILE_MEDIA } from "@/lib/es/stage-images";
import { useLiveCopy } from "@/lib/es/live-copy";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Everything Simulated | Gold Coast Racing & Flight Simulator Workshop",
      description:
        "Australia's dedicated simulator workshop on the Gold Coast. Turn-key racing, aircraft, drone and training simulators — assembled, tested and shipped nationwide with a compatibility guarantee.",
      path: "/",
    }),
  component: Home,
});

const VALUES = [
  { icon: Wrench, title: "Built and tested here", body: "Every rig is assembled, cable-managed and driven on the Gold Coast before it ships." },
  { icon: ShieldCheck, title: "Compatibility checked", body: "Torque, payload, quick-release and mount clearances are verified on every part list." },
  { icon: Gauge, title: "Try before you buy", body: "Book the studio and drive the rig set to your seating position before you commit." },
  { icon: MapPin, title: "Australia-wide", body: "Crated freight from the workshop to your door, with setup support after delivery." },
];

export function Home() {
  const { fill } = useLiveCopy();
  const faqs = FAQS.map((f) => ({ q: f.q, a: fill(f.a) }));

  return (
    <SiteShell>
      <JsonLd data={graphLd(organizationLd(), websiteLd(), localBusinessLd(), faqLd(faqs))} />
      <HomeHero />
      <TrustBar />

      <section className="ds-section" aria-labelledby="values-title">
        <div className="ds-container">
          <h2 id="values-title" className="ds-visually-hidden">Why Everything Simulated</h2>
          <div className="ds-values">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="ds-value">
                <Icon className="size-5" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeaturedPrebuilds />

      <section className="ds-section">
        <div className="ds-container ds-split">
          <div className="ds-split-media ds-ratio-photo">
            <SiteImage src="/rigs/es-cat-chassis.jpg" alt="Everything Simulated cockpit chassis in the studio" sizes="(min-width: 1024px) 50vw, 100vw" width={1600} height={1200} />
          </div>
          <div>
            <p className="ds-eyebrow">Rig builder</p>
            <h2 className="ds-h1">Spec it part by part</h2>
            <p className="ds-lead">Pick a cockpit, base, wheel, pedals and screens. The builder checks every combination as you go and prices it live.</p>
            <ol className="ds-steps">
              <li><strong>Choose your parts</strong><span>The same components our technicians fit.</span></li>
              <li><strong>Check it fits</strong><span>Clashes and limits are flagged before you pay.</span></li>
              <li><strong>We build and ship it</strong><span>Assembled, tested and crated from the Gold Coast.</span></li>
            </ol>
            <div className="ds-actions">
              <Link to="/build" className="ds-btn ds-btn-light ds-btn-lg">Open the builder <ArrowRight className="size-4" /></Link>
              <Link to="/shop" className="ds-btn">Browse parts</Link>
            </div>
          </div>
        </div>
      </section>

      <FeaturedAmbassadors />

      <section className="ds-banner" aria-labelledby="studio-title">
        <SiteImage src="/rigs/es-cat-screens.jpg" alt="" sizes="100vw" width={1600} height={900} />
        <div className="ds-container">
          <p className="ds-eyebrow">Gold Coast studio</p>
          <h2 id="studio-title" className="ds-h1">Drive it before you buy it</h2>
          <p className="ds-lead">Book a session at the {BRAND.region} workshop. Pedal spacing, wheel height and screens are set to you before anything ships.</p>
          <div className="ds-actions">
            <Link to="/studio" className="ds-btn ds-btn-light ds-btn-lg">Book a studio session</Link>
            <Link to="/contact" className="ds-btn">Talk to the workshop</Link>
          </div>
        </div>
      </section>

      <section className="ds-section" aria-labelledby="faq-title">
        <div className="ds-container">
          <div className="ds-section-head">
            <div>
              <p className="ds-eyebrow">FAQ</p>
              <h2 id="faq-title" className="ds-h1">Questions, answered</h2>
            </div>
            <Link to="/faqs" className="ds-link">All FAQs <ArrowRight className="size-4" /></Link>
          </div>
          <div className="ds-faq">
            {faqs.slice(0, 4).map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function HomeHero() {
  const wide = STAGE_IMAGES["/"];
  const tall = STAGE_IMAGES_MOBILE["/"];
  return (
    <section className="ds-hero" aria-labelledby="hero-title">
      <div className="ds-hero-art">
        <picture>
          {tall ? <source media={MOBILE_MEDIA} type="image/webp" srcSet={rigSrcSet(tall)} sizes="100vw" /> : null}
          {tall ? <source media={MOBILE_MEDIA} srcSet={tall} /> : null}
          <source type="image/webp" srcSet={rigSrcSet(wide)} sizes="100vw" />
          <img src={wide} alt="Everything Simulated racing simulator with curved triple screens in the studio" width={2400} height={1350} fetchPriority="high" loading="eager" decoding="sync" />
        </picture>
      </div>
      <div className="ds-container ds-hero-copy">
        <p className="ds-eyebrow">Gold Coast simulator workshop</p>
        <h1 id="hero-title" className="ds-display">Racing simulators, built properly.</h1>
        <p className="ds-lead">Turn-key cockpits with motion, direct-drive and curved triple screens. Assembled, tested and shipped Australia-wide.</p>
        <div className="ds-actions">
          <Link to="/prebuilds" className="ds-btn ds-btn-light ds-btn-lg">Shop prebuilds <ArrowRight className="size-4" /></Link>
          <Link to="/build" className="ds-btn ds-btn-lg">Build your own</Link>
        </div>
        <ul className="ds-hero-meta" aria-label="Also from the workshop">
          <li><Link to="/aircraft">Aircraft</Link></li>
          <li><Link to="/drones">Drones</Link></li>
          <li><Link to="/training">Training</Link></li>
        </ul>
      </div>
    </section>
  );
}

function FeaturedPrebuilds() {
  const featured = useQuery({ queryKey: ["featured-prebuilds"], queryFn: fetchFeaturedPrebuilds });
  const items = featured.data ?? [];
  return (
    <section className="ds-section" aria-labelledby="prebuilds-title">
      <div className="ds-container">
        <div className="ds-section-head">
          <div>
            <p className="ds-eyebrow">Prebuilds</p>
            <h2 id="prebuilds-title" className="ds-h1">Ready-to-drive rigs</h2>
          </div>
          <Link to="/prebuilds" className="ds-link">All prebuilds <ArrowRight className="size-4" /></Link>
        </div>
        {featured.isPending ? (
          <div className="ds-rig-grid" role="status" aria-busy="true" aria-label="Loading prebuilds">
            {[0, 1, 2].map((i) => <RigCardSkeleton key={i} />)}
          </div>
        ) : featured.isError ? (
          <LoadError what="the prebuilds" onRetry={() => void featured.refetch()} />
        ) : items.length === 0 ? (
          <p className="ds-muted">
            No prebuilds are listed right now. <Link to="/build" className="ds-link">Build one from parts</Link>.
          </p>
        ) : (
          <div className="ds-rig-grid">
            {items.map((p) => <RigCard key={p.id} prebuild={p} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedAmbassadors() {
  const q = useQuery({ queryKey: ["ambassadors"], queryFn: fetchAmbassadors, staleTime: 10 * 60_000 });
  const people = (q.data ?? []).filter((a) => a.published).slice(0, 4);
  if (!people.length) return null;
  return (
    <section className="ds-section" aria-labelledby="ambassadors-title">
      <div className="ds-container">
        <div className="ds-section-head">
          <div>
            <p className="ds-eyebrow">Ambassadors</p>
            <h2 id="ambassadors-title" className="ds-h1">Driven by racers</h2>
          </div>
          <Link to="/ambassadors" className="ds-link">Meet the team <ArrowRight className="size-4" /></Link>
        </div>
        <div className="ds-people">
          {people.map((a) => (
            <Link key={a.slug} to={ambassadorProfilePath(a.slug)} className="ds-person">
              <div className="ds-media">
                <PersonPhoto name={a.name} src={a.photo} sizes="(min-width: 1024px) 25vw, 50vw" />
              </div>
              <h3>{a.name}</h3>
              {a.series || a.motorsport ? <p>{a.series || a.motorsport}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
