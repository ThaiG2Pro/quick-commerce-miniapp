import Carousel from "@/components/carousel";
import OptimizedImage from "@/components/optimized-image";
import { useAtomValue } from "jotai";
import { bannersState } from "@/state";

export default function Banners() {
  const banners = useAtomValue(bannersState);

  return (
    <Carousel
      slides={banners.map((banner, i) => (
        <OptimizedImage key={i} className="w-full rounded" src={banner} alt={`banner-${i}`} />
      ))}
    />
  );
}
