/**
 * Features Module - Map feature exports
 */

export type {
  MapFeature,
  FeatureConfig,
  FeatureState,
  FeatureMetadata,
  FeatureConstructor,
  FeatureFactory,
} from "./Feature.interface"

export { MarkerFeature } from "./markers/MarkerFeature"
export { BoundaryFeature } from "./polygons/BoundaryFeature"
export { DrawingFeature } from "./drawing/DrawingFeature"
export type { DrawingMode } from "./drawing/DrawingFeature"
export { PolylineFeature } from "./polylines/PolylineFeature"
export { SearchFeature, createSearchFeature } from "./search/SearchFeature"
export type { SearchFeatureConfig } from "./search/SearchFeature"

export { BaseFeature, createFeatureFactory } from "./Feature.interface"
export { FeatureRegistry, featureRegistry } from "./FeatureRegistry"
