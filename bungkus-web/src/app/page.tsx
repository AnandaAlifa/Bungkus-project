import { HeroSection } from "@/components/landing/HeroSection";
import { ImpactStats } from "@/components/landing/ImpactStats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeaturedDeals } from "@/components/landing/FeaturedDeals";
import { MerchantCTA } from "@/components/landing/MerchantCTA";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ImpactStats />
      <HowItWorks />
      <FeaturedDeals />
      <MerchantCTA />
    </>
  );
}
