import type { CatalogImagePricing } from "../credits";
import type { ObservedModel } from "./model-discovery";
import type { ProviderName } from "./types";

export function isImageCandidate(provider: ProviderName, item: ObservedModel) {
  if (provider === "openai") return /^gpt-image-\d+(?:\.\d+)?(?:-(?:flare|sunburst|mini))?$/.test(item.id);
  if (provider === "xai") return item.image === true && /^grok-imagine-image-\d+\.\d+$/.test(item.id);
  if (provider !== "google") return false;
  return /^gemini-\d+(?:\.\d+)?-(?:flash(?:-lite)?|pro)-image$/.test(item.id) && item.methods?.includes("generateContent") ||
    /^imagen-\d+\.\d+(?:-[a-z]+)*-\d{3}$/.test(item.id) && item.methods?.includes("predict");
}

export function imagePriceSource(provider: ProviderName, id: string) {
  if (provider === "openai") return `https://developers.openai.com/api/docs/models/${id}.md`;
  if (provider === "xai") return `https://docs.x.ai/developers/models/${id}.md`;
  return "https://aistudio.google.com/docs/pricing.md";
}

const positiveRate = (value: string | undefined) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
};

export function parseImagePricing(provider: ProviderName, item: ObservedModel, document: string): CatalogImagePricing | undefined {
  if (!isImageCandidate(provider, item)) return;
  const reference = imagePriceSource(provider, item.id);

  if (provider === "openai") {
    if (!document.includes(`Model ID: \`${item.id}\``) ||
        !document.includes("Output modalities: image") ||
        !/\| Image generation \| `v1\/images\/generations` \| Supported \|/.test(document)) return;
    // Official calculator at 1024x1024, medium quality, rounded up by one token.
    const squareTokens = /^gpt-image-2\.6-(?:flare|sunburst)$/.test(item.id) ? 1450
      : /^gpt-image-2\.5-(?:flare|sunburst)$/.test(item.id) ? 440 : undefined;
    if (!squareTokens) return;
    const text = document.split("### Text tokens")[1]?.split(/^### |^## /m)[0];
    const image = document.split("### Image tokens")[1]?.split(/^### |^## /m)[0];
    const prompt = positiveRate(text?.match(/^\| Input \| \$([\d.]+) \| 1M tokens \|$/m)?.[1]);
    const output = positiveRate(image?.match(/^\| Output \| \$([\d.]+) \| 1M tokens \|$/m)?.[1]);
    if (!prompt || !output) return;
    return { imageProfile: "openai_square", perImageUsd: squareTokens * output / 1_000_000, promptPerMillion: prompt, outputImagePerMillion: output, reference };
  }

  if (provider === "xai") {
    if (!document.includes(`**Model name:** \`${item.id}\``) ||
        !/\*\*Modalities:\*\* text(?:, image)? → image/.test(document)) return;
    const tierPrice = positiveRate(document.match(/^\| 1K \| Low \| \$([\d.]+) \|$/mi)?.[1]);
    // The 2.0 card's headline is the documented 1K low-quality price.
    const price = tierPrice ?? (item.id === "grok-imagine-image-2.0"
      ? positiveRate(document.match(/^- \*\*Output:\*\* \$([\d.]+) per image$/m)?.[1]) : undefined);
    if (!price) return;
    return { imageProfile: "xai_1k", perImageUsd: price, promptPerMillion: 0, reference };
  }

  const section = document.split(/^## /m).find((block) => block.split("\n", 1)[0].includes(`id="${item.id}"`));
  const standard = section?.split('{% tab title="Standard" %}')[1]?.split("{% /tab %}")[0];
  if (item.id.startsWith("imagen-")) {
    const price = positiveRate(standard?.match(/^\s*\* \$([\d.]+) per image\s*$/m)?.[1]);
    if (price) return { imageProfile: "imagen_single", perImageUsd: price, promptPerMillion: 0, reference };
    return;
  }
  const sizeTokens = positiveRate(section?.match(/1K \(1024x1024px\) consume\s+(\d+) tokens/)?.[1]);
  const prompt = positiveRate(standard?.match(/^\s*\* \$([\d.]+) \(text\/image(?:\/video)?\)\s*$/m)?.[1]);
  const imageOutput = positiveRate(standard?.match(/^\s*\$([\d.]+) \(images\)\s*$/m)?.[1]);
  const textOutput = positiveRate(standard?.match(/^\s*\* \$([\d.]+) \(text and thinking\)\s*$/m)?.[1]);
  if (!sizeTokens || !prompt || !imageOutput || !textOutput) return;
  return { imageProfile: "gemini_1k", perImageUsd: sizeTokens * imageOutput / 1_000_000, promptPerMillion: prompt, textOutputPerMillion: textOutput, outputImagePerMillion: imageOutput, reference };
}
