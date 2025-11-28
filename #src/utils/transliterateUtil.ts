import { transliterate as tr } from 'transliteration';

export function transliterateString(input: string): string {
    // Транслитерируем кириллические символы в латинские
    input = input.replace(/\s+/g, '_');
    return tr(input);
}