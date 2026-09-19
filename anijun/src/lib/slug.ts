const CYR_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(str: string): string {
  return str.split("").map((ch) => {
    const lower = ch.toLowerCase();
    if (CYR_MAP[lower] !== undefined) {
      return CYR_MAP[lower];
    }
    return ch;
  }).join("");
}

export function generateSlug(title: string): string {
  let s = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
  s = s.replace(/-+/g, "-").replace(/_+/g, "_").replace(/^-+|-+$/g, "").replace(/^_+|_+$/g, "");
  if (!s) {
    s = transliterate(title).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    s = s.replace(/-+/g, "-").replace(/_+/g, "_").replace(/^-+|-+$/g, "").replace(/^_+|_+$/g, "");
  }
  return s;
}

export function sanitizeSlugInput(value: string): string {
  let s = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
  s = s.replace(/-+/g, "-").replace(/_+/g, "_");
  return s;
}
