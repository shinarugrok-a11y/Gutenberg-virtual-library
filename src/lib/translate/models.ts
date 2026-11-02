/** OPUS-MT / Helsinki-NLP (CC-BY-4.0), ONNX conversions by Xenova.
 * Explicit English target model table; no NLLB or M2M models are permitted.
 * https://huggingface.co/Helsinki-NLP · https://huggingface.co/Xenova
 */
export const LANGUAGES = [
  { code: "es", name: "Spanish", model: "Xenova/opus-mt-en-es" },
  { code: "fr", name: "French", model: "Xenova/opus-mt-en-fr" },
  { code: "de", name: "German", model: "Xenova/opus-mt-en-de" },
  { code: "it", name: "Italian", model: "Xenova/opus-mt-en-it" },
  { code: "nl", name: "Dutch", model: "Xenova/opus-mt-en-nl" },
  { code: "ru", name: "Russian", model: "Xenova/opus-mt-en-ru" },
  { code: "zh", name: "Chinese", model: "Xenova/opus-mt-en-zh" },
  { code: "ar", name: "Arabic", model: "Xenova/opus-mt-en-ar" },
  { code: "hi", name: "Hindi", model: "Xenova/opus-mt-en-hi" },
  { code: "uk", name: "Ukrainian", model: "Xenova/opus-mt-en-uk" },
  { code: "sv", name: "Swedish", model: "Xenova/opus-mt-en-sv" },
  { code: "fi", name: "Finnish", model: "Xenova/opus-mt-en-fi" },
  { code: "cs", name: "Czech", model: "Xenova/opus-mt-en-cs" },
  { code: "ro", name: "Romanian", model: "Xenova/opus-mt-en-ro" },
] as const;
export const CREDITS = "Machine translation: OPUS-MT (CC-BY 4.0)";
export type TranslationJob = {
  id: number;
  book: number;
  source: string;
  target: string;
  leaf: number;
  text: string;
};
