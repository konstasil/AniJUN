import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session?.user) {
      const user = data.session.user;
      const provider = user.app_metadata?.provider;


      if (provider === "google" && user.user_metadata?.avatar_url) {
        const googleAvatarUrl = user.user_metadata.avatar_url;

        try {

          const response = await fetch(googleAvatarUrl);
          const imageBlob = await response.blob();


          const ext = googleAvatarUrl.split(".").pop()?.split("?")[0] || "jpg";
          const filePath = `${user.id}/avatar.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("users")
            .upload(filePath, imageBlob, {
              upsert: true,
              contentType: imageBlob.type,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from("users")
              .getPublicUrl(filePath);

            const storageUrl = publicUrlData.publicUrl;

            // Обновляем профиль
            await supabase
              .from("profiles")
              .update({ avatar_url: storageUrl })
              .eq("id", user.id);
          }
        } catch {
          // Если не удалось скачать/загрузить — просто продолжаем
        }
      }

      // Если это Google OAuth и пользователь еще не выбрал никнейм — редирект на выбор ника
      const { data: profile } = await supabase
        .from("profiles")
        .select("username_claimed")
        .eq("id", user.id)
        .single();

      if (provider === "google" && profile && !profile.username_claimed) {
        return NextResponse.redirect(`${origin}/signup?oauth=google`);
      }

      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login${safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""}`
  );
}