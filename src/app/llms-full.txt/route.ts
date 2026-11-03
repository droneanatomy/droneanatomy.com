import { llmsFullTxt } from '../llms-content';

/* Static: written once at build into out/llms-full.txt — see llms-content.ts. */
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsFullTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
