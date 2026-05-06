/**
 * Inline EPUB2 toc.ncx fixtures. Element names are case-sensitive XML.
 */

export const NESTED_NCX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:test"/></head>
  <docTitle><text>Test Book</text></docTitle>
  <navMap>
    <navPoint id="nav-1" playOrder="1">
      <navLabel><text>Introduction</text></navLabel>
      <content src="intro.html"/>
    </navPoint>
    <navPoint id="nav-2" playOrder="2">
      <navLabel><text>Part One</text></navLabel>
      <content src="part1.html"/>
      <navPoint id="nav-2-1" playOrder="3">
        <navLabel><text>Chapter One</text></navLabel>
        <content src="chap01.html"/>
      </navPoint>
      <navPoint id="nav-2-2" playOrder="4">
        <navLabel><text>Chapter Two</text></navLabel>
        <content src="chap02.html"/>
      </navPoint>
    </navPoint>
  </navMap>
</ncx>`;

export const FLAT_NCX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head/>
  <docTitle><text>Flat NCX</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>Chapter A</text></navLabel>
      <content src="chap01.html"/>
    </navPoint>
    <navPoint id="np2" playOrder="2">
      <navLabel><text>Chapter B</text></navLabel>
      <content src="chap02.html"/>
    </navPoint>
    <navPoint id="np3" playOrder="3">
      <navLabel><text>Chapter C</text></navLabel>
      <content src="chap03.html"/>
    </navPoint>
  </navMap>
</ncx>`;

export const NCX_WITH_FRAGMENTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head/>
  <docTitle><text>Fragmented</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1">
      <navLabel><text>Section One</text></navLabel>
      <content src="chap01.html#sec1"/>
    </navPoint>
    <navPoint id="np2" playOrder="2">
      <navLabel><text>Note Two</text></navLabel>
      <content src="chap01.html#note%202"/>
    </navPoint>
  </navMap>
</ncx>`;
