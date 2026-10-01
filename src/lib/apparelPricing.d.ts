export const DEFAULT_GARMENT_SOURCING: any;
export const DEFAULT_APPAREL_PRICING: any;
export function normalizeGarmentSourcing(raw?: any): any;
export function normalizeApparelPricing(raw?: any): any;
export function apparelProductKey(type?: string, name?: string): "tshirt" | "crewneck" | "hoodie" | null;
export function apparelPlacementKey(placement?: string): "front" | "front_back";
export function getExactBundlePrice(config: any, productKey: string, placement: string, quantity: number): number | null;
export function getVolumePercent(config: any, quantity: number): number;
