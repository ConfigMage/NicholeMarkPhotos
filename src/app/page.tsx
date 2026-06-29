import ConfigNotice from "@/components/ConfigNotice";
import Gallery from "@/components/Gallery";
import Header from "@/components/Header";
import UploadSection from "@/components/UploadSection";
import { isConfigured } from "@/lib/supabase";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
      <Header />
      {isConfigured ? (
        <>
          <UploadSection />
          <Gallery />
        </>
      ) : (
        <ConfigNotice />
      )}
    </main>
  );
}
