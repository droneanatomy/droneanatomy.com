import { llmsTxt } from '../llms-content';

/* Static: written once at build into out/llms.txt — see llms-content.ts. */
export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
