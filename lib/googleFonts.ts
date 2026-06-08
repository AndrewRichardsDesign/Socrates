export interface GoogleFont {
  family: string;
  variants: string[];
  category: string;
}

export interface FontVariant {
  value: string;
  label: string;
  style: 'normal' | 'italic';
  weight: number;
}

const POPULAR_FONTS: GoogleFont[] = [
  { family: 'Inter', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], category: 'sans-serif' },
  { family: 'Roboto', variants: ['100', '300', '400', '500', '700', '900', '100italic', '300italic', 'italic', '500italic', '700italic', '900italic'], category: 'sans-serif' },
  { family: 'Open Sans', variants: ['300', '400', '500', '600', '700', '800', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic'], category: 'sans-serif' },
  { family: 'Lato', variants: ['100', '300', '400', '700', '900', '100italic', '300italic', 'italic', '700italic', '900italic'], category: 'sans-serif' },
  { family: 'Montserrat', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Poppins', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Source Sans Pro', variants: ['200', '300', '400', '600', '700', '900', '200italic', '300italic', 'italic', '600italic', '700italic', '900italic'], category: 'sans-serif' },
  { family: 'Noto Sans', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Raleway', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Nunito', variants: ['200', '300', '400', '500', '600', '700', '800', '900', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Playfair Display', variants: ['400', '500', '600', '700', '800', '900', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'serif' },
  { family: 'Merriweather', variants: ['300', '400', '700', '900', '300italic', 'italic', '700italic', '900italic'], category: 'serif' },
  { family: 'Lora', variants: ['400', '500', '600', '700', 'italic', '500italic', '600italic', '700italic'], category: 'serif' },
  { family: 'PT Serif', variants: ['400', '700', 'italic', '700italic'], category: 'serif' },
  { family: 'Libre Baskerville', variants: ['400', '700', 'italic'], category: 'serif' },
  { family: 'Crimson Text', variants: ['400', '600', '700', 'italic', '600italic', '700italic'], category: 'serif' },
  { family: 'Source Serif Pro', variants: ['200', '300', '400', '600', '700', '900', '200italic', '300italic', 'italic', '600italic', '700italic', '900italic'], category: 'serif' },
  { family: 'Georgia', variants: ['400', '700', 'italic', '700italic'], category: 'serif' },
  { family: 'Times New Roman', variants: ['400', '700', 'italic', '700italic'], category: 'serif' },
  { family: 'Roboto Mono', variants: ['100', '200', '300', '400', '500', '600', '700', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic'], category: 'monospace' },
  { family: 'JetBrains Mono', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic'], category: 'monospace' },
  { family: 'Fira Code', variants: ['300', '400', '500', '600', '700'], category: 'monospace' },
  { family: 'Source Code Pro', variants: ['200', '300', '400', '500', '600', '700', '800', '900', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'monospace' },
  { family: 'Space Grotesk', variants: ['300', '400', '500', '600', '700'], category: 'sans-serif' },
  { family: 'Work Sans', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Outfit', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], category: 'sans-serif' },
  { family: 'DM Sans', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '100italic', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic', '900italic'], category: 'sans-serif' },
  { family: 'Lexend', variants: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], category: 'sans-serif' },
  { family: 'Atkinson Hyperlegible', variants: ['400', '700', 'italic', '700italic'], category: 'sans-serif' },
  { family: 'Spectral', variants: ['200', '300', '400', '500', '600', '700', '800', '200italic', '300italic', 'italic', '500italic', '600italic', '700italic', '800italic'], category: 'serif' },
];

let cachedFonts: GoogleFont[] | null = null;

export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  if (cachedFonts !== null) {
    return cachedFonts;
  }
  
  try {
    const response = await fetch(
      'https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyAOES8EmKhuJEnsn9kS1XKBpxxp-TgN8Jc&sort=popularity'
    );
    
    if (!response.ok) {
      console.warn('Google Fonts API unavailable, using fallback list');
      cachedFonts = POPULAR_FONTS;
      return POPULAR_FONTS;
    }
    
    const data = await response.json();
    const fonts: GoogleFont[] = data.items?.slice(0, 200).map((item: any) => ({
      family: item.family,
      variants: item.variants,
      category: item.category,
    })) || POPULAR_FONTS;
    cachedFonts = fonts;
    
    return fonts;
  } catch (error) {
    console.warn('Failed to fetch Google Fonts, using fallback list:', error);
    cachedFonts = POPULAR_FONTS;
    return POPULAR_FONTS;
  }
}

export function parseVariants(variants: string[]): FontVariant[] {
  const weightNames: Record<string, string> = {
    '100': 'Thin',
    '200': 'Extra Light',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'Semi Bold',
    '700': 'Bold',
    '800': 'Extra Bold',
    '900': 'Black',
  };
  
  const result: FontVariant[] = [];
  const seenWeights = new Set<string>();
  
  for (const variant of variants) {
    const isItalic = variant.includes('italic');
    let weight = variant.replace('italic', '').trim();
    
    if (weight === '' || variant === 'regular') {
      weight = '400';
    }
    if (variant === 'italic') {
      weight = '400';
    }
    
    const numWeight = parseInt(weight, 10);
    if (isNaN(numWeight)) continue;
    
    const key = `${weight}-${isItalic ? 'italic' : 'normal'}`;
    if (seenWeights.has(key)) continue;
    seenWeights.add(key);
    
    const style = isItalic ? 'italic' : 'normal';
    const label = `${weightNames[weight] || weight}${isItalic ? ' Italic' : ''}`;
    
    result.push({
      value: `${weight}${isItalic ? 'italic' : ''}`,
      label,
      style,
      weight: numWeight,
    });
  }
  
  result.sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.style === 'normal' ? -1 : 1;
  });
  
  return result;
}

const loadedFonts = new Set<string>();

export function loadGoogleFont(family: string, variants: string[] = ['400', '700']): void {
  const key = `${family}:${variants.join(',')}`;
  if (loadedFonts.has(key)) return;
  
  loadedFonts.add(key);
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  
  // Parse variants into weight/italic pairs for Google Fonts CSS2 API
  // Format: family=Font:ital,wght@0,400;0,700;1,400;1,700
  const specs: string[] = [];
  const normalWeights = new Set<string>();
  const italicWeights = new Set<string>();
  
  for (const variant of variants) {
    const isItalic = variant.includes('italic');
    let weight = variant.replace('italic', '').replace('regular', '400').trim();
    if (!weight) weight = '400';
    
    if (isItalic) {
      italicWeights.add(weight);
    } else {
      normalWeights.add(weight);
    }
  }
  
  // Build specs array: ital,wght@0,weight;1,weight
  const hasItalics = italicWeights.size > 0;
  
  if (hasItalics) {
    // Use ital,wght format when italics are present
    Array.from(normalWeights).forEach(w => {
      specs.push(`0,${w}`);
    });
    Array.from(italicWeights).forEach(w => {
      specs.push(`1,${w}`);
    });
    specs.sort(); // Sort for consistent ordering
    const familySpec = `${family.replace(/ /g, '+')}:ital,wght@${specs.join(';')}`;
    link.href = `https://fonts.googleapis.com/css2?family=${familySpec}&display=swap`;
  } else {
    // Simple wght format for non-italic fonts
    const weights = Array.from(normalWeights).sort().join(';');
    const familySpec = `${family.replace(/ /g, '+')}:wght@${weights || '400'}`;
    link.href = `https://fonts.googleapis.com/css2?family=${familySpec}&display=swap`;
  }
  
  document.head.appendChild(link);
}

export function getFontCategories(): { value: string; label: string }[] {
  return [
    { value: 'all', label: 'All' },
    { value: 'sans-serif', label: 'Sans Serif' },
    { value: 'serif', label: 'Serif' },
    { value: 'monospace', label: 'Monospace' },
    { value: 'display', label: 'Display' },
    { value: 'handwriting', label: 'Handwriting' },
  ];
}
