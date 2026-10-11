// Applied before first paint via a blocking <script> in index.html to
// avoid a light-then-dark flash. Kept in public/ (shipped as its own
// file) so the production CSP (script-src 'self') permits it.
try {
  var t = localStorage.getItem('theme')
  var dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
} catch (e) {}
