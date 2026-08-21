/* Lenis smooth scroll.
   The stepped section reads its progress from Lenis, not from window.scroll, so
   this has to be the single scroll authority on the page. One rAF drives it;
   the WebGL loops keep their own, which is fine — they read state, they do not
   own it.
   Reduced motion gets native scrolling: a hijacked scroll with no easing is
   worse than no hijack at all. */
import Lenis from 'lenis';

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({ smoothWheel: true, syncTouch: false });
  window.lenis = lenis;               /* the stepped section subscribes to this */
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
