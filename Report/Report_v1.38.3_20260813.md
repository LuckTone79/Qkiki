# Report v1.38.3-20260813

## Summary

Restored the public authentication flow to the Supabase Auth implementation and fixed the sign-in form that was calling removed legacy endpoints.

## Findings

- The production sign-in page was still using /api/auth/google/start and /api/auth/\${mode}.
- Those legacy routes were removed by the Supabase Auth migration; the supported routes are /api/auth/oauth/\${provider} and /auth/callback.
- The production Supabase project has email auth enabled, but Google and Kakao providers are currently disabled in Supabase Auth settings.

## Changes

- Updated src/components/AuthForm.tsx to use the Supabase browser client for email sign-in and sign-up.
- Added Google and Kakao links to the current Supabase OAuth route.
- Preserved safe next handling and embedded-browser fallback behavior.
- Added email-confirmation handling and Turnstile token submission for email auth.
- Bumped the visible application version to v1.38.3-20260813.

## Verification

- npx tsc -p tsconfig.json --noEmit passed.
- npm run lint passed.
- npm test passed: 193 tests, 0 failures.
- npm run build passed.
- Live diagnosis confirmed /api/auth/oauth/google and /api/auth/oauth/kakao create Supabase PKCE redirects.

## External configuration required

Enable Google and Kakao in the Supabase Dashboard for project xoxnkezwrrbwkdjlupkp and register the callback URL:

https://xoxnkezwrrbwkdjlupkp.supabase.co/auth/v1/callback

The application callback remains:

https://yapp.wideget.net/auth/callback

OAuth client secrets are intentionally not stored in the repository or Vercel environment.
