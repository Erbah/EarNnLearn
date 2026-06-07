/**
 * CediTrees 2.0 - Content Security & Cleanup Utility
 * ------------------------------------------------
 * A production-grade hybrid renderer that intelligently transitions between
 * natural language prose and technical code context.
 */

export type RenderMode = 'lesson' | 'code' | 'auto';

/**
 * Heuristically detects if the content is technical code or natural language prose.
 */
function detectRenderMode(text: string): 'lesson' | 'code' {
  if (!text) return 'lesson';
  
  // High confidence code signals
  if (text.includes('```')) return 'code';
  
  const codeSignals = ['{', '}', '=>', 'import ', 'export ', 'function ', 'const ', 'let ', ';'];
  const symbolCount = codeSignals.reduce((acc, sig) => acc + (text.split(sig).length - 1), 0);
  
  // Calculate symbol density (relative to words)
  const wordCount = text.split(/\s+/).length || 1;
  const density = symbolCount / wordCount;
  
  // Threshold: If density > 0.15 or has explicit backticks + math patterns
  if (density > 0.15 || (text.includes('`') && text.includes('**'))) return 'code';
  
  return 'lesson';
}
export function cleanLessonContent(text: string, mode: RenderMode = 'auto'): string {
  if (!text) return "";

  // ═══════════════════════════════════════════════════════════════
  // STAGE 0: Safety & Math Protection
  // ═══════════════════════════════════════════════════════════════
  
  // 0a. Protect Math Blocks (LaTeX)
  const mathBlocks: string[] = [];
  let cleaned = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
    const ph = `[!!MATHPH${mathBlocks.length}!!]`;
    mathBlocks.push(`<div class="my-6 p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-serif text-cyan-300 shadow-inner overflow-x-auto">${math}</div>`);
    return ph;
  });
  cleaned = cleaned.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
    const ph = `[!!MATHPH${mathBlocks.length}!!]`;
    mathBlocks.push(`<span class="px-2 font-serif text-cyan-200 italic">${math}</span>`);
    return ph;
  });

  // First, escape angle brackets to prevent HTML injection, BUT we will restore whitelisted ones later
  cleaned = cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const resolvedMode = mode === 'auto' ? detectRenderMode(text) : mode;

  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: Full [WHITEBOARD: ...] Tag Removal
  // ═══════════════════════════════════════════════════════════════
  let startIndex;
  while ((startIndex = cleaned.indexOf("[WHITEBOARD:")) !== -1) {
    let bracketCount = 0;
    let braceCount = 0;
    let endIndex = -1;
    for (let i = startIndex; i < cleaned.length; i++) {
      if (cleaned[i] === "[") bracketCount++;
      else if (cleaned[i] === "]") bracketCount--;
      else if (cleaned[i] === "{") braceCount++;
      else if (cleaned[i] === "}") braceCount--;
      
      if (bracketCount === 0 && braceCount === 0 && i > startIndex + 12) {
        endIndex = i;
        break;
      }
    }
    if (endIndex !== -1) {
      cleaned = cleaned.substring(0, startIndex) + cleaned.substring(endIndex + 1);
    } else {
      cleaned = cleaned.substring(0, startIndex);
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 2: Orphaned Fragment Removal
  // ═══════════════════════════════════════════════════════════════
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*(?:"[^"]*"|[\d.]+|true|false)(?:\s*,\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*(?:"[^"]*"|[\d.]+|true|false|\[[^\]]*\]))*\s*\}\s*\]/g, "");
  cleaned = cleaned.replace(/\{"action":\s*"[^"]*"[\s\S]*?\}\s*\]?/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration)":\s*"?#?[a-fA-F0-9".\s]*[\s\S]*?\}\s*\]/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*"[^"]*$/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*"[^"]*"?\s*$/g, "");
  cleaned = cleaned.replace(/\s*\[\s*$/g, "");
  cleaned = cleaned.replace(/\s*\]\s*(?=[A-Z])/g, " ");
  cleaned = cleaned.replace(/,\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points|x|y)":\s*(?:"[^"]*"|[\d.]+|true|false|\{[^}]*\}|\[[^\]]*\])/g, "");

  cleaned = cleaned.replace(/\[CONTINUE\]/g, "");

  if (resolvedMode === 'code') {
    return cleaned.replace(/\s\s+/g, " ").trim();
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: Full Markdown-to-HTML Conversion
  // ═══════════════════════════════════════════════════════════════
  const placeholders: string[] = [];

  cleaned = cleaned.replace(/`([^`]+)`/g, (_match, code) => {
    const ph = `[!!CODEPH${placeholders.length}!!]`;
    placeholders.push(`<code class="px-1.5 py-0.5 bg-white/10 rounded text-sm font-mono text-cyan-300">${code}</code>`);
    return ph;
  });

  cleaned = cleaned.replace(/([a-zA-Z0-9_]+)\*\*([a-zA-Z0-9_]+)/g, "$1[!!EXPPH!!]$2");

  cleaned = cleaned.replace(/^##\s+(Title|Explanation|Deep Dive|Examples|Key Takeaways|Bridge to Next Section)\s*$/gm, "");

  cleaned = cleaned.replace(/^####\s+(.+)$/gm, '<h4 class="text-lg font-bold text-white mt-6 mb-2">$1</h4>');
  cleaned = cleaned.replace(/^###\s+(.+)$/gm, '<h3 class="text-xl font-bold text-white mt-6 mb-3">$1</h3>');
  cleaned = cleaned.replace(/^##\s+(.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-8 mb-4">$1</h2>');
  cleaned = cleaned.replace(/^#\s+(.+)$/gm, '<h1 class="text-3xl font-black text-white mt-8 mb-4">$1</h1>');

  cleaned = cleaned.replace(/\*\*(\S(.*?\S)?)\*\*/g, "<strong>$1</strong>");
  cleaned = cleaned.replace(/__(\S(.*?\S)?)__/g, "<strong>$1</strong>");
  cleaned = cleaned.replace(/\*(\S(.*?\S)?)\*/g, "<em>$1</em>");
  cleaned = cleaned.replace(/_(\S(.*?\S)?)_/g, "<em>$1</em>");

  cleaned = cleaned.replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 mb-1 list-disc list-inside text-gray-200">$1</li>');
  cleaned = cleaned.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul class="my-3 space-y-1">$1</ul>');

  cleaned = cleaned.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 mb-1 list-decimal list-inside text-gray-200">$1</li>');

  cleaned = cleaned.replace(/\[!!EXPPH!!\]/g, "**");
  
  // 🔗 LINK SUPPORT (v2.1)
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-bold">$1</a>');
  
  placeholders.forEach((val, i) => {
    cleaned = cleaned.replace(`[!!CODEPH${i}!!]`, val);
  });

  // ═══════════════════════════════════════════════════════════════
  // STAGE 4: Paragraph & Spacing
  // ═══════════════════════════════════════════════════════════════

  const blocks = cleaned.split(/\n\n+/);
  cleaned = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    
    // Check if the block is already effectively an HTML tag (accounting for previous escaping)
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('<h') || lower.startsWith('<ul') || lower.startsWith('<ol') || 
      lower.startsWith('<li') || lower.startsWith('<div') || lower.startsWith('<br') ||
      lower.startsWith('&lt;p') || lower.startsWith('&lt;ul') || lower.startsWith('&lt;li') ||
      lower.startsWith('&lt;div') || lower.startsWith('&lt;h')
    ) {
      return trimmed;
    }
    return `<p class="mb-4 leading-relaxed">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).filter(Boolean).join('\n');

  // ═══════════════════════════════════════════════════════════════
  // STAGE 5: Whitelist Restoration (Sanitization)
  // ═══════════════════════════════════════════════════════════════
  // Restore whitelisted tags that may have been present in original text and escaped
  // We handle both whitelisted tags the AI might have sent and tags we generated
  cleaned = cleaned
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, "<strong>$1</strong>")
    .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, "<em>$1</em>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br/>")
    .replace(/&lt;p(.*?)&gt;/gi, "<p$1>")
    .replace(/&lt;\/p&gt;/gi, "</p>")
    .replace(/&lt;ul(.*?)&gt;/gi, "<ul$1>")
    .replace(/&lt;\/ul&gt;/gi, "</ul>")
    .replace(/&lt;li(.*?)&gt;/gi, "<li$1>")
    .replace(/&lt;\/li&gt;/gi, "</li>")
    .replace(/&lt;span(.*?)&gt;/gi, "<span$1>")
    .replace(/&lt;\/span&gt;/gi, "</span>")
    .replace(/&lt;div(.*?)&gt;/gi, "<div$1>")
    .replace(/&lt;\/div&gt;/gi, "</div>")
    .replace(/&lt;h([1-4])(.*?)&gt;/gi, "<h$1$2>")
    .replace(/&lt;\/h([1-4])&gt;/gi, "</h$1>")
    .replace(/&lt;a(.*?)&gt;(.*?)&lt;\/a&gt;/gi, "<a$1>$2</a>");

  // ═══════════════════════════════════════════════════════════════
  // STAGE 6: Math Restoration
  // ═══════════════════════════════════════════════════════════════
  mathBlocks.forEach((val, i) => {
    cleaned = cleaned.replace(`[!!MATHPH${i}!!]`, val);
  });

  // ═══════════════════════════════════════════════════════════════
  // STAGE 7: Final Normalization
  // ═══════════════════════════════════════════════════════════════
  cleaned = cleaned.replace(/[ \t]+/g, " ").trim();

  return cleaned;
}
