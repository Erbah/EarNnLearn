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
  // STAGE 0: Safety & Intent Detection
  // ═══════════════════════════════════════════════════════════════

  // First, escape all angle brackets to prevent HTML injection from AI or User
  let cleaned = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const resolvedMode = mode === 'auto' ? detectRenderMode(text) : mode;

  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: Full [WHITEBOARD: ...] Tag Removal (Bracket + Brace Counting)
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
  // STAGE 2: Orphaned Fragment Removal (Legacy Database Corruption)
  // ═══════════════════════════════════════════════════════════════

  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*(?:"[^"]*"|[\d.]+|true|false)(?:\s*,\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*(?:"[^"]*"|[\d.]+|true|false|\[[^\]]*\]))*\s*\}\s*\]/g, "");
  cleaned = cleaned.replace(/\{"action":\s*"[^"]*"[\s\S]*?\}\s*\]?/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration)":\s*"?#?[a-fA-F0-9".\s]*[\s\S]*?\}\s*\]/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*"[^"]*$/g, "");
  cleaned = cleaned.replace(/,?\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points)":\s*"[^"]*"?\s*$/g, "");
  cleaned = cleaned.replace(/\s*\[\s*$/g, "");
  cleaned = cleaned.replace(/\s*\]\s*(?=[A-Z])/g, " ");
  cleaned = cleaned.replace(/,\s*"(?:color|width|duration|fill|fillOpacity|fontSize|action|points|x|y)":\s*(?:"[^"]*"|[\d.]+|true|false|\{[^}]*\}|\[[^\]]*\])/g, "");

  // Remove [CONTINUE] protocol markers
  cleaned = cleaned.replace(/\[CONTINUE\]/g, "");

  // If in Code mode, we stop here (after cleanup) to preserve raw technical symbols
  if (resolvedMode === 'code') {
    return cleaned.replace(/\s\s+/g, " ").trim();
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: Full Markdown-to-HTML Conversion
  // ═══════════════════════════════════════════════════════════════
  const placeholders: string[] = [];

  // 3a. Protect Inline Code
  cleaned = cleaned.replace(/`([^`]+)`/g, (_match, code) => {
    const ph = `[!!CODEPH${placeholders.length}!!]`;
    placeholders.push(`<code class="px-1.5 py-0.5 bg-white/10 rounded text-sm font-mono text-cyan-300">${code}</code>`);
    return ph;
  });

  // 3b. Protect Mathematical Exponents (e.g. x**2 should not become bold)
  cleaned = cleaned.replace(/([a-zA-Z0-9_]+)\*\*([a-zA-Z0-9_]+)/g, "$1[!!EXPPH!!]$2");

  // 3c. Remove Elite Protocol Headers that are metadata, not content
  // These are the section markers like "## Explanation", "## Deep Dive" etc.
  // They get converted to semantic badges by LessonPlayer, so strip them from body text.
  cleaned = cleaned.replace(/^##\s+(Title|Explanation|Deep Dive|Examples|Key Takeaways|Bridge to Next Section)\s*$/gm, "");

  // 3d. Convert remaining markdown headers to HTML
  cleaned = cleaned.replace(/^####\s+(.+)$/gm, '<h4 class="text-lg font-bold text-white mt-6 mb-2">$1</h4>');
  cleaned = cleaned.replace(/^###\s+(.+)$/gm, '<h3 class="text-xl font-bold text-white mt-6 mb-3">$1</h3>');
  cleaned = cleaned.replace(/^##\s+(.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-8 mb-4">$1</h2>');
  cleaned = cleaned.replace(/^#\s+(.+)$/gm, '<h1 class="text-3xl font-black text-white mt-8 mb-4">$1</h1>');

  // 3e. Convert bold and italic
  cleaned = cleaned.replace(/\*\*(\S(.*?\S)?)\*\*/g, "<strong>$1</strong>");
  cleaned = cleaned.replace(/__(\S(.*?\S)?)__/g, "<strong>$1</strong>");
  cleaned = cleaned.replace(/\*(\S(.*?\S)?)\*/g, "<em>$1</em>");
  cleaned = cleaned.replace(/_(\S(.*?\S)?)_/g, "<em>$1</em>");

  // 3f. Convert unordered lists (- item or * item)
  cleaned = cleaned.replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 mb-1 list-disc list-inside text-gray-200">$1</li>');
  // Wrap consecutive <li> elements in <ul>
  cleaned = cleaned.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul class="my-3 space-y-1">$1</ul>');

  // 3g. Convert numbered lists (1. item)
  cleaned = cleaned.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 mb-1 list-decimal list-inside text-gray-200">$1</li>');

  // 3h. Restore exponent placeholder
  cleaned = cleaned.replace(/\[!!EXPPH!!\]/g, "**");
  
  // 3i. Restore code placeholders
  placeholders.forEach((val, i) => {
    cleaned = cleaned.replace(`[!!CODEPH${i}!!]`, val);
  });

  // ═══════════════════════════════════════════════════════════════
  // STAGE 4: Paragraph & Spacing
  // ═══════════════════════════════════════════════════════════════

  // Split into blocks by double newlines
  const blocks = cleaned.split(/\n\n+/);
  cleaned = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    // Don't wrap blocks that are already HTML elements
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<li') || trimmed.startsWith('<div') || trimmed.startsWith('<br')) {
      return trimmed;
    }
    // Wrap plain text blocks in paragraphs
    return `<p class="mb-4 leading-relaxed">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).filter(Boolean).join('\n');

  // ═══════════════════════════════════════════════════════════════
  // STAGE 5: Whitelist Restoration (Sanitization)
  // ═══════════════════════════════════════════════════════════════
  // Restore whitelisted tags that may have been present in original text and escaped
  cleaned = cleaned
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, "<strong>$1</strong>")
    .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, "<em>$1</em>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br/>");

  // ═══════════════════════════════════════════════════════════════
  // STAGE 6: Final Normalization
  // ═══════════════════════════════════════════════════════════════
  // Clean up excessive whitespace but preserve intentional spacing
  cleaned = cleaned.replace(/[ \t]+/g, " ").trim();

  return cleaned;
}
