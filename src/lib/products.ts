import type { Product } from "./types";

export const PRODUCT_CATEGORY_ORDER = [
  "Pratos",
  "Aperitivos",
  "Bebidas",
  "Acompanhamentos",
  "Embalagens",
] as const;

function categoryRank(category: string) {
  const normalized = category.trim().toLowerCase();
  const index = PRODUCT_CATEGORY_ORDER.findIndex(
    (name) => name.toLowerCase() === normalized
  );
  return index === -1 ? PRODUCT_CATEGORY_ORDER.length : index;
}

export function groupProductsByCategory(products: Product[]) {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const category = product.category?.trim() || "Geral";
    const list = groups.get(category) ?? [];
    list.push(product);
    groups.set(category, list);
  }

  return Array.from(groups.entries()).sort(([a], [b]) => {
    const rankDiff = categoryRank(a) - categoryRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b, "pt-BR");
  });
}
