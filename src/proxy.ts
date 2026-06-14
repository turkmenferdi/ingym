import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/program", "/gunluk", "/yemek", "/olcum"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  try {
    const { supabaseUrl, supabaseAnonKey } = readEnv(process.env);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } catch {
    // Supabase yapılandırılmamış/erişilemezse siteyi 500'e düşürme; sayfa-içi guard korur.
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.png$).*)"],
};
