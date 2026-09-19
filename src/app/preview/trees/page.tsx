/* A SCRATCH ROUTE, and it is not part of the site.

   The forest is under review: the question is whether instanced conifers
   get the homepage's flight section close enough to the reference flyover
   to be worth having, without giving up the stylised palette that the
   section's ink copy and dark nav are set against. That is a judgement
   nobody can make from a description, so this renders the real section —
   same beats, same craft, same camera — with the trees switchable.

   THE TOGGLE REBUILDS THE SCENE. FlightScene lists `trees` among its
   effect's dependencies, so flipping it disposes the whole world and
   builds the other one — about a second, and no special machinery needed
   here to arrange it.

   DELETE THIS ROUTE once the decision is made. If trees are kept, the
   flag stops being a flag; if they are not, both this and trees.ts go. */

import { TreesPreview } from './TreesPreview';

export const metadata = {
  title: 'Trees — preview',
  /* Not indexed: this is a working surface, not a page. */
  robots: { index: false, follow: false },
};

export default function TreesPreviewPage() {
  return <TreesPreview />;
}
