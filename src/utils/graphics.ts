import { DomIds } from "../constants/strings";

// Marker used to claim the shared SVG overlay once per rendered frame.
const OVERLAY_CLAIM_KEY = "roseaOverlayClaimedBy";

// Set SVG viewport size
export function setSvgSize(svg: any, width: number, height: number) {
  svg.attr('width', width).attr('height', height);
}

/**
 * Compares a datum's selection id against the current selection.
 *
 * Power BI selection ids must be compared with `equals()`. Reference equality only
 * holds for ids the visual itself passed to `select()`, so selections originating
 * elsewhere (slicers, other visuals, bookmarks) would otherwise never match.
 */
export function isSelectionIdSelected(selectedIds: any[], datumId: any): boolean {
  if (!datumId || !selectedIds || selectedIds.length === 0) return false;
  return selectedIds.some((selectedId) =>
    typeof selectedId?.equals === 'function' ? selectedId.equals(datumId) : selectedId === datumId
  );
}

// Compute opacity based on selection state (dim unselected)
export function selectionOpacity(selectedIds: any[], datumId: any, baseOpacity: number) {
  if (!selectedIds || selectedIds.length === 0) return baseOpacity;
  return isSelectionIdSelected(selectedIds, datumId) ? baseOpacity : baseOpacity / 2;
}

/**
 * Claims the shared overlay container for the current frame.
 *
 * The choropleth and circle SVG layers draw into one container but are separate
 * OpenLayers layers. OpenLayers only de-duplicates the element returned by the
 * immediately preceding layer, so any layer rendered between them would push the
 * container into the layer list twice and thrash the DOM every frame. The first
 * layer to render in a frame contributes the container; later layers return null.
 */
export function claimSharedOverlay(frameState: any, container: HTMLElement): HTMLElement | null {
  if (!frameState) return container;
  if (frameState[OVERLAY_CLAIM_KEY] === container) return null;
  frameState[OVERLAY_CLAIM_KEY] = container;
  return container;
}

// Ensure circles groups render above choropleth paths
export function reorderForCirclesAboveChoropleth(svg: any) {
  const choroplethGroupNode = svg.select(`#${DomIds.ChoroplethGroup}`).node();
  const circles1GroupNode = svg.select(`#${DomIds.CirclesGroup1}`).node();
  const circles2GroupNode = svg.select(`#${DomIds.CirclesGroup2}`).node();
  const labelsGroupNode = svg.select(`#${DomIds.CircleLabelsGroup}`).node();
  if (choroplethGroupNode && circles1GroupNode && circles2GroupNode) {
    choroplethGroupNode.parentNode.appendChild(circles1GroupNode);
    choroplethGroupNode.parentNode.appendChild(circles2GroupNode);
    if (labelsGroupNode) {
      choroplethGroupNode.parentNode.appendChild(labelsGroupNode);
    }
  }
}
