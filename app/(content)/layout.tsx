import RateInfoModal from "@/components/map/RateInfoModal";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100svh] flex-1 flex-col bg-white">
      <SiteHeader />
      {children}
      <SiteFooter />
      {/* Lets the CurrencyToggle's exchange-rate info button work on list pages. */}
      <RateInfoModal />
    </div>
  );
}
