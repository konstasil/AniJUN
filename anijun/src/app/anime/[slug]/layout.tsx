import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    let anime: { title: string; image_url: string } | null = null;
    const { data: bySlug } = await supabase.from("anime").select("title, image_url").eq("slug", slug).maybeSingle();
    if (bySlug) anime = bySlug;
    else {
      const num = parseInt(slug);
      if (!isNaN(num)) {
        const { data } = await supabase.from("anime").select("title, image_url").eq("id", num).maybeSingle();
        if (data) anime = data;
      }
    }
    if (!anime) return { title: "AniJUN" };
    return {
      title: `${anime.title} | AniJUN`,
      openGraph: {
        title: `${anime.title} | AniJUN`,
        images: [{ url: anime.image_url }],
      },
      twitter: { card: "summary_large_image", title: anime.title, images: [anime.image_url] },
    };
  } catch {
    return { title: "AniJUN" };
  }
}

export default function AnimeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
