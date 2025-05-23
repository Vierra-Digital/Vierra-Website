import { CaseStudies } from "../WorkSection/CaseStudies";
import { Services } from "./Services";

export default function Main() {
  return (
    <main className="min-h-screen bg-[#010205] text-white">
      <div className="relative">
        <Services />
        <CaseStudies />
      </div>
    </main>
  );
}
