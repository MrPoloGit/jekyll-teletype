# Splits a page's markdown into plain chunks and ::: screen ::: / ::: wide :::
# chunks, and wraps EACH chunk in its own <div class="sheet" markdown="1">
# (plain, or inside .screen/.wide), so .screen/.wide end up SIBLINGS of
# .sheet (matching the source page's actual structure) — never nested inside
# one. kramdown still runs markdown over every chunk.
#
#   ::: screen         ::: wide
#   ... markdown ...   ... markdown ...
#   :::                 :::
#
# "screen" inverts the ink/paper colors for that section (see .screen in
# main.css). "wide" breaks a section out of the normal ~96ch text column up
# to .wide's own max-width (see main.css) — for content that genuinely needs
# more horizontal room, like a wide SVG diagram, not a general-purpose class.
# No nesting, no other block types — one split pass.
BLOCK = /^:::[ \t]*(screen|wide)[ \t]*\n(.*?)\n:::[ \t]*$\n?/m

def wrap_sheets(content)
  parts = content.split(BLOCK)
  out = +""
  parts.each_slice(3) do |plain, kind, inner|
    out << "<div class=\"sheet\" markdown=\"1\">\n#{plain}\n</div>\n\n" unless plain.nil? || plain.strip.empty?
    next unless kind
    if kind == "wide"
      # No nested .sheet: the whole point is escaping .sheet's ~96ch column, so
      # re-adding it here would just put the constraint right back. This also
      # means content inside ::: wide ::: gets no gutter number of its own —
      # matches the source page, where a breakout figure isn't a numbered row.
      out << "<div class=\"wide\" markdown=\"1\">\n#{inner}\n</div>\n\n"
    else
      out << "<div class=\"#{kind}\">\n<div class=\"sheet\" markdown=\"1\">\n#{inner}\n</div>\n</div>\n\n"
    end
  end
  out
end

MARKDOWN_EXT = /\.(md|markdown)\z/i

Jekyll::Hooks.register [:pages, :documents], :pre_render do |doc|
  next unless doc.extname =~ MARKDOWN_EXT
  doc.content = wrap_sheets(doc.content) if doc.content
end
