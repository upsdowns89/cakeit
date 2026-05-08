import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const role = searchParams.get('role') ?? 'buyer';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get current user to create profile if needed (for OAuth signups)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          // Auto-create profile for OAuth users
          const nickname =
            user.user_metadata?.full_name ||
            user.user_metadata?.nickname ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            '사용자';

          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email || '',
            nickname,
            role: role as 'buyer' | 'seller' | 'admin',
          });

          // If seller role, redirect to shop registration
          if (role === 'seller') {
            return NextResponse.redirect(`${origin}/seller/register`);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
