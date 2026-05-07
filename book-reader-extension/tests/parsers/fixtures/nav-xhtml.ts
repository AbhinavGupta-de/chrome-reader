/**
 * Inline EPUB3 nav.xhtml fixtures used by parser tests.
 * Strings only — no binary .epub files needed because the parsers under test
 * accept raw XML.
 */

export const NESTED_NAV_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>TOC</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
        <li><a href="intro.xhtml">Introduction</a></li>
        <li>
          <a href="part1.xhtml">Part One</a>
          <ol>
            <li><a href="chap01.xhtml">Chapter One</a></li>
            <li><a href="chap02.xhtml">Chapter Two</a></li>
          </ol>
        </li>
      </ol>
    </nav>
  </body>
</html>`;

export const FLAT_NAV_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="some-other-file.xhtml">First</a></li>
        <li><a href="another-file.xhtml">Second</a></li>
      </ol>
    </nav>
  </body>
</html>`;

export const NAV_WITH_FRAGMENTS_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chap01.xhtml#sec1">Section One</a></li>
        <li><a href="chap01.xhtml#Section%202.1">Section Two Point One</a></li>
      </ol>
    </nav>
  </body>
</html>`;

export const NAV_WITH_FILENAME_LABELS_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chap01.xhtml">ch01.xhtml</a></li>
        <li><a href="chap02.xhtml">ch02.xhtml</a></li>
      </ol>
    </nav>
  </body>
</html>`;
