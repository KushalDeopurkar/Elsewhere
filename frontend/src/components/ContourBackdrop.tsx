/**
 * The page's background: a contour map, the "where" in "where to be".
 * Thin height lines in the ink colour, with every fourth (the index lines)
 * picked out in a sweep of the category colours.
 *
 * The lines are two static SVGs in /public/bg, used as CSS masks over a
 * fill, so they follow the theme's colours, are fetched once and cached,
 * and cost nothing per frame. The map drifts very slowly by transform
 * alone (the GPU moves it, the page never repaints), and stays still for
 * reduced motion. It fades out behind the content column so text always
 * sits on a plain background.
 */
export default function ContourBackdrop() {
  return (
    <div className="cbg" aria-hidden="true">
      <div className="cbg-drift">
        <div className="cbg-lines" />
        <div className="cbg-index" />
      </div>
    </div>
  );
}
