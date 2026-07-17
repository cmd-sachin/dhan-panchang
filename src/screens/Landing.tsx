import { motion } from "framer-motion";
import {
  ArrowRight,
  NotebookPen,
  CalendarRange,
  BellRing,
  WifiOff,
  Users,
  Landmark,
  Store,
  Sprout,
  ShieldCheck,
  Database,
  Languages,
  Mic,
  LineChart,
  Layers,
  HandCoins,
  Check,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Public landing / explainer page. Plain language, English. Two guest entry
// points: business owner and field officer. Content maps the product to the
// NABARD brief, the consumer segment, the value for banks, and the roadmap.
// ─────────────────────────────────────────────────────────────────────────────

function EnterButtons({
  onEnterprise,
  onOfficer,
  size = "default",
}: {
  onEnterprise: () => void;
  onOfficer: () => void;
  size?: "default" | "lg";
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button size={size} onClick={onEnterprise}>
        <Store className="size-5" /> Enter as business owner
        <ArrowRight className="size-4" />
      </Button>
      <Button size={size} variant="soft" onClick={onOfficer}>
        <Landmark className="size-5" /> Enter as field officer
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className={`mx-auto w-full max-w-5xl px-5 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-forest">
      {children}
    </div>
  );
}

function HeroMock() {
  const bars = [
    "tight", "deficit", "deficit", "deficit", "surplus", "tight",
    "surplus", "surplus", "tight", "surplus", "surplus", "tight",
  ];
  const color: Record<string, string> = {
    surplus: "var(--surplus)",
    tight: "var(--tight)",
    deficit: "var(--deficit)",
  };
  return (
    <div className="rounded-[28px] border border-border bg-card p-5 shadow-xl">
      <div className="rounded-[20px] bg-primary p-5 text-primary-foreground">
        <div className="text-xs text-primary-foreground/70">Cash today</div>
        <div className="tnum text-3xl font-extrabold">₹7,297</div>
        <div className="mt-3 flex items-end gap-[3px]">
          {bars.map((b, i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className="h-12 flex-1 origin-bottom rounded-[3px]"
              style={{ background: color[b] }}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-3 text-[10px] text-primary-foreground/70">
          <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: "var(--surplus)" }} />Money left over</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: "var(--deficit)" }} />Short of cash</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-deficit-soft/50 p-3.5">
        <BellRing className="mt-0.5 size-5 shrink-0 text-deficit" />
        <div>
          <div className="text-sm font-bold text-foreground">Feed prices up ~18% in your district</div>
          <div className="text-xs text-muted-foreground">Tight around Week 6 · buy feed early</div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-forest">
          <Icon className="size-5" />
        </span>
        <h3 className="mt-4 font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-forest">
        <Check className="size-3.5" />
      </span>
      <span className="text-sm leading-relaxed text-foreground/80">{children}</span>
    </li>
  );
}

export function Landing({
  onEnterprise,
  onOfficer,
}: {
  onEnterprise: () => void;
  onOfficer: () => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Brand />
          <div className="hidden gap-2 sm:flex">
            <Button size="sm" variant="ghost" onClick={onOfficer}>
              <Landmark className="size-4" /> Field officer
            </Button>
            <Button size="sm" onClick={onEnterprise}>
              <Store className="size-4" /> Business owner
            </Button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Eyebrow>NABARD Hackathon · Global FinTech Fest 2026</Eyebrow>
          <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Know your money, months before it happens.
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            Dhan Panchang is a simple money almanac for rural businesses. It
            predicts your cash for the next 6 months, warns you weeks before
            money gets tight, and works even with no internet.
          </p>
          <div className="mt-7">
            <EnterButtons onEnterprise={onEnterprise} onOfficer={onOfficer} size="lg" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No sign-up needed. Continue as a guest.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <HeroMock />
        </motion.div>
      </section>

      {/* who it's for */}
      <Section className="py-12">
        <Eyebrow>Who it is for</Eyebrow>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight">
          Built for rural India's smallest businesses, and the people who fund them
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <FeatureCard icon={Sprout} title="Micro-enterprises">
            Dairy farmers, poultry keepers, food processors, handicraft makers
            and village shopkeepers - the everyday businesses that keep villages
            running.
          </FeatureCard>
          <FeatureCard icon={Users} title="Groups: SHGs & FPOs">
            Self-Help Groups and Farmer Producer Organisations that save, borrow
            and grow together - and need a shared money picture.
          </FeatureCard>
          <FeatureCard icon={Landmark} title="Banks & field officers">
            NABARD field officers and rural banks who guide these businesses and
            decide who is ready for a loan.
          </FeatureCard>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Many of these businesses have no formal credit history, so banks
          cannot easily judge them. Dhan-Panchang gives every one of them a
          clear, growing money record - the first step from grants and informal
          loans towards formal bank credit.
        </p>
      </Section>

      {/* how it works */}
      <Section className="py-12">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="text-3xl font-bold tracking-tight">Four simple steps</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <FeatureCard icon={NotebookPen} title="1. Note your money">
            Write down what comes in and goes out - in your own language, or just
            by speaking.
          </FeatureCard>
          <FeatureCard icon={CalendarRange} title="2. See 6 months ahead">
            A colour calendar shows the good weeks and the tight weeks across the
            next six months.
          </FeatureCard>
          <FeatureCard icon={BellRing} title="3. Get early warnings">
            Know weeks before cash runs short - with the reason, and a clear
            suggestion of what to do.
          </FeatureCard>
          <FeatureCard icon={WifiOff} title="4. Works offline">
            Everything runs on your phone. No internet, no problem - it gets
            smarter whenever a network appears.
          </FeatureCard>
        </div>
      </Section>

      {/* how it helps */}
      <Section className="py-12">
        <Eyebrow>How it helps</Eyebrow>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-forest">
                <Store className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">For business owners</h3>
              <ul className="mt-4 space-y-3">
                <CheckItem>Plan ahead and avoid sudden cash shortages.</CheckItem>
                <CheckItem>Get warned early, with the reason and what to do about it.</CheckItem>
                <CheckItem>Test "what if" - like a bad monsoon or costlier feed - in one tap.</CheckItem>
                <CheckItem>Build a money record that proves you can repay a loan.</CheckItem>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-forest">
                <Landmark className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">For banks & field officers</h3>
              <ul className="mt-4 space-y-3">
                <CheckItem>See which businesses need help first, sorted by urgency.</CheckItem>
                <CheckItem>Spot shared risks across many businesses at once, and act together.</CheckItem>
                <CheckItem>Lend with confidence using a clear repayment picture.</CheckItem>
                <CheckItem>Monitor a whole portfolio of rural enterprises from one screen.</CheckItem>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* NABARD alignment */}
      <Section className="py-12">
        <Eyebrow>Made for NABARD's mission</Eyebrow>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight">
          It fits the schemes NABARD already runs
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={Users} title="SHG-Bank Linkage">
            Groups get a shared cash-flow and repayment view that maps directly
            onto NABARD's flagship SHG-Bank Linkage programme.
          </FeatureCard>
          <FeatureCard icon={ShieldCheck} title="From grants to credit">
            A Credit Readiness summary helps a business show it can repay - the
            bridge from grant support to a formal bank loan.
          </FeatureCard>
          <FeatureCard icon={HandCoins} title="Financial inclusion">
            Credit-invisible rural businesses finally get a track record, opening
            the door to affordable, formal finance.
          </FeatureCard>
          <FeatureCard icon={Layers} title="A digital public good">
            One free, offline tool for enterprise profiling, cash-flow forecasting
            and risk monitoring - usable by any institution.
          </FeatureCard>
        </div>
      </Section>

      {/* real data + future */}
      <Section className="py-12">
        <div className="rounded-[28px] bg-primary p-8 text-primary-foreground md:p-10">
          <Eyebrow>
            <Database className="size-3.5" /> Real data makes it sharper
          </Eyebrow>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-primary-foreground">
            Working today. Even better with live data.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-primary-foreground/75">
            This prototype runs on realistic simulated data, calibrated on public
            seasonal patterns - so the forecasting and risk engine can be
            demonstrated end to end, offline, with no sensitive personal
            information. Connected to real sources, the same engine gets far more
            accurate:
          </p>
          <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              "UPI and digital transaction trends (no personal data)",
              "Live commodity prices from Agmarknet",
              "Weather and monsoon outlook from IMD / Open-Meteo",
              "SHG and cooperative savings and repayment records",
            ].map((s) => (
              <div key={s} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-sm text-primary-foreground/85">{s}</span>
              </div>
            ))}
          </div>

          <div className="my-8 h-px bg-white/10" />

          <Eyebrow>What's next</Eyebrow>
          <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {[
              { icon: Landmark, t: "A field pilot with a partner bank or NABARD to measure real accuracy." },
              { icon: Users, t: "Group mode for SHGs and Joint Liability Groups." },
              { icon: ShieldCheck, t: "A bank-ready Credit Readiness Passport, exportable as one page." },
              { icon: Mic, t: "Spoken advisories in each user's own language." },
              { icon: LineChart, t: "A supervisory dashboard for banks and institutions." },
              { icon: Languages, t: "More sectors and more Indian languages." },
            ].map(({ icon: Icon, t }) => (
              <div key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm text-primary-foreground/85">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* final CTA */}
      <Section className="py-14">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight">
            Try it now - pick how you want to explore
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Enter as a business owner to see your own money almanac, or as a
            field officer to monitor a whole portfolio.
          </p>
          <EnterButtons onEnterprise={onEnterprise} onOfficer={onOfficer} size="lg" />
        </div>
      </Section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center">
          <Brand compact />
          <p className="text-xs text-muted-foreground">
            A concept built for the NABARD Hackathon at Global FinTech Fest 2026.
            Prototype uses simulated data.
          </p>
        </div>
      </footer>
    </div>
  );
}
