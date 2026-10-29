# Splits a page's markdown into alternating plain / ::: screen ::: chunks, and
# wraps EACH chunk in its own <div class="sheet" markdown="1">, so .screen ends
# up as a SIBLING of .sheet (matching the source page's actual structure) —
# never nested inside one. kramdown still runs markdown over every chunk.
#
#   ::: screen
#   ... markdown ...
#   :::
#
# marks a section that should invert the ink/paper colors (see .screen in
# assets/css/main.css). No nesting, no other block types — one split pass.
SCREEN_BLOCK = /^:::[ \t]*screen[ \t]*\n(.*?)\n:::[ \t]*$\n?/m

def wrap_sheets(content)
  parts = content.split(SCREEN_BLOCK)
  out = +""
  parts.each_with_index do |part, i|
    if i.odd?
      out << "<div class=\"screen\">\n<div class=\"sheet\" markdown=\"1\">\n#{part}\n</div>\n</div>\n\n"
    elsif !part.strip.empty?
      out << "<div class=\"sheet\" markdown=\"1\">\n#{part}\n</div>\n\n"
    end
  end
  out
end

MARKDOWN_EXT = /\.(md|markdown)\z/i

Jekyll::Hooks.register [:pages, :documents], :pre_render do |doc|
  next unless doc.extname =~ MARKDOWN_EXT
  doc.content = wrap_sheets(doc.content) if doc.content
end
