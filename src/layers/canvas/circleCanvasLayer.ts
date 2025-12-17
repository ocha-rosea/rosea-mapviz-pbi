import { Layer } from 'ol/layer.js';
import { FrameState } from 'ol/Map';
import { State } from 'ol/source/Source';
import type { Extent } from 'ol/extent.js';
import { transformExtent } from 'ol/proj.js';
import { CircleLayerOptions, CircleLabelOptions } from '../../types';
import { getCanvasAndCtx, mercatorProjector } from './canvasUtils';
import { selectionOpacity } from '../../utils/graphics';
import * as d3 from 'd3';
import { createWebMercatorProjection } from '../../utils/map';
import { aggregateToH3Hexbins, getHexbinColor, boundaryToLngLat, H3Hexbin, H3AggregationType, H3ColorRamp, H3ColorOptions } from '../../utils/h3Aggregation';

export class CircleCanvasLayer extends Layer {
  public options: CircleLayerOptions;
  private selectedIds: powerbi.extensibility.ISelectionId[] = [];
  private isActive = true;

  constructor(options: CircleLayerOptions) {
    super({ ...options, zIndex: options.zIndex || 10 });
    this.options = options;
    this.changed();
  }

  getSourceState(): State { return 'ready'; }
  setActive(active: boolean) { this.isActive = active; this.changed(); }

  render(frameState: FrameState) {
    if (!this.isActive) return;
    const width = frameState.size[0];
    const height = frameState.size[1];
  const { canvas, ctx, dpr } = getCanvasAndCtx(this.options.svgContainer, width, height, 'circles-canvas');
  // Ensure circles render above choropleth
  canvas.style.zIndex = '20';
  // Clear in device pixels and scale to CSS pixels for drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  const project = mercatorProjector(frameState, width, height);
  const { longitudes = [], latitudes = [], combinedCircleSizeValues = [], circle1SizeValues = [], circle2SizeValues = [], circleOptions, minCircleSizeValue = 0, maxCircleSizeValue = 100, circleScale: scaleFactor = 1 } = this.options;

  // Check if hotspot mode
  const isHotspot = circleOptions.chartType === 'hotspot';
  const hotspotRadius = circleOptions.hotspotRadius || 20;
  const hotspotIntensity = circleOptions.hotspotIntensity || 1;
  const hotspotColor = circleOptions.hotspotColor || circleOptions.color1;
  const hotspotGlowColor = circleOptions.hotspotGlowColor || hotspotColor;
  const hotspotBlurAmount = circleOptions.hotspotBlurAmount || 15;
  const hotspotMinOpacity = (circleOptions.hotspotMinOpacity || 40) / 100;
  const hotspotMaxOpacity = (circleOptions.hotspotMaxOpacity || 95) / 100;
  const hotspotScaleByValue = circleOptions.hotspotScaleByValue !== false;

  // Apply blur/glow effects using canvas shadow
  let { enableBlur = false, blurRadius = 5, enableGlow = false, glowColor = '#FFFFFF', glowIntensity = 10 } = circleOptions;
  
  // Hotspot mode: auto-enable glow with dedicated settings
  if (isHotspot) {
    enableGlow = true;
    enableBlur = true;
    glowIntensity = hotspotIntensity * 15;
    glowColor = hotspotGlowColor;
    blurRadius = hotspotBlurAmount;
  }

  // Check for H3 hexbin mode
  const isH3Hexbin = circleOptions.chartType === 'h3-hexbin';

  if (enableGlow) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowIntensity * 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (enableBlur) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = blurRadius * 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // H3 Hexbin mode: aggregate points and render hexagons
  if (isH3Hexbin) {
    this.renderH3Hexbins(ctx, frameState, width, height);
    return this.options.svgContainer;
  }

    const allRelevantValues = [...combinedCircleSizeValues];
    for (let i = 0; i < Math.min(circle1SizeValues.length, circle2SizeValues.length); i++) {
      if (circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
        allRelevantValues.push(circle1SizeValues[i] + circle2SizeValues[i]);
      }
    }

    const circleScale = (v: number) => {
      const minR2 = circleOptions.minRadius * circleOptions.minRadius;
      const clamped = Math.max(minCircleSizeValue, Math.min(v, maxCircleSizeValue as number));
      const r = Math.sqrt(minR2 + (clamped - minCircleSizeValue) * scaleFactor);
      return Math.max(r, circleOptions.minRadius);
    };

  // Remove any previous hit overlay and recreate
  this.options.svg.select('#circles-hitlayer').remove();
  const hitLayer = this.options.svg.append('g').attr('id', 'circles-hitlayer');
  hitLayer.style('pointer-events', 'all');
  const d3Projection = createWebMercatorProjection(frameState, width, height);

  for (let i = 0; i < longitudes.length; i++) {
      const [x, y] = project(longitudes[i], latitudes[i]);
      
      // Calculate radius based on mode
      let r1: number;
      if (isHotspot) {
        if (hotspotScaleByValue && circle1SizeValues[i] !== undefined && maxCircleSizeValue > minCircleSizeValue) {
          // Scale hotspot size based on data value (between 0.3x and 1.5x base radius)
          const normalized = (circle1SizeValues[i] - minCircleSizeValue) / (maxCircleSizeValue - minCircleSizeValue);
          r1 = hotspotRadius * (0.3 + normalized * 1.2);
        } else {
          r1 = hotspotRadius;
        }
      } else {
        r1 = circle1SizeValues[i] !== undefined ? circleScale(circle1SizeValues[i]) : circleOptions.minRadius;
      }
      const r2 = circle2SizeValues[i] !== undefined ? circleScale(circle2SizeValues[i]) : circleOptions.minRadius;

      const chartType = circleOptions.chartType;
      
      // Hotspot rendering - glowing heat points
      if (isHotspot) {
        ctx.beginPath();
        ctx.arc(x, y, r1, 0, 2*Math.PI);
        const selId = this.options.dataPoints?.[i]?.selectionId as any;
        // Calculate opacity based on value and min/max settings
        let opacity = hotspotMaxOpacity;
        if (hotspotScaleByValue && circle1SizeValues[i] !== undefined && maxCircleSizeValue > minCircleSizeValue) {
          const normalized = (circle1SizeValues[i] - minCircleSizeValue) / (maxCircleSizeValue - minCircleSizeValue);
          opacity = hotspotMinOpacity + normalized * (hotspotMaxOpacity - hotspotMinOpacity);
        }
        ctx.fillStyle = applyOpacity(hotspotColor, selectionOpacity(this.selectedIds, selId, opacity));
        ctx.fill();
        // No stroke for hotspots

        // Invisible hit target
        const [hx, hy] = d3Projection([longitudes[i], latitudes[i]]) as [number, number];
        const hit = hitLayer.append('circle')
          .attr('cx', hx)
          .attr('cy', hy)
          .attr('r', r1)
          .style('fill', 'transparent')
          .style('stroke', 'transparent')
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .datum(this.options.dataPoints?.[i]?.selectionId);
        if (this.options.dataPoints?.[i]?.tooltip) {
          this.options.tooltipServiceWrapper.addTooltip(
            hit as any,
            () => this.options.dataPoints?.[i]?.tooltip,
            () => this.options.dataPoints?.[i]?.selectionId,
            true
          );
        }
        hit.on('click', (event: MouseEvent) => {
          const selectionId = this.options.dataPoints?.[i]?.selectionId;
          const nativeEvent = event;
          this.options.selectionManager.select(selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
            .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { this.selectedIds = selectedIds; this.changed(); });
        });
      } else if (chartType === 'donut-chart' && circle2SizeValues.length > 0 && circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
        const v1 = circle1SizeValues[i];
        const v2 = circle2SizeValues[i];
        const total = v1 + v2;
        const outer = circleScale(total);
        const inner = Math.max(outer * 0.6, 1);
        // arc1
        const selId = this.options.dataPoints?.[i]?.selectionId as any;
        drawArc(ctx, x, y, inner, outer, 0, (v1/total) * 2*Math.PI, applyOpacity(circleOptions.color1, selectionOpacity(this.selectedIds, selId, circleOptions.layer1Opacity)), circleOptions.strokeColor, circleOptions.strokeWidth);
        // arc2
        drawArc(ctx, x, y, inner, outer, (v1/total) * 2*Math.PI, 2*Math.PI, applyOpacity(circleOptions.color2, selectionOpacity(this.selectedIds, selId, circleOptions.layer2Opacity)), circleOptions.strokeColor, circleOptions.strokeWidth);

        // Invisible hit target using SVG circle at outer radius
        const [hx, hy] = d3Projection([longitudes[i], latitudes[i]]) as [number, number];
        const hit = hitLayer.append('circle')
          .attr('cx', hx)
          .attr('cy', hy)
          .attr('r', outer)
          .style('fill', 'transparent')
          .style('stroke', 'transparent')
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .datum(this.options.dataPoints?.[i]?.selectionId);
        if (this.options.dataPoints?.[i]?.tooltip) {
          this.options.tooltipServiceWrapper.addTooltip(
            hit as any,
            () => this.options.dataPoints?.[i]?.tooltip,
            () => this.options.dataPoints?.[i]?.selectionId,
            true
          );
        }
        hit.on('click', (event: MouseEvent) => {
          const selectionId = this.options.dataPoints?.[i]?.selectionId;
          const nativeEvent = event;
          this.options.selectionManager.select(selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
            .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { this.selectedIds = selectedIds; this.changed(); });
        });
      } else if (chartType === 'pie-chart' && circle2SizeValues.length > 0 && circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
        const v1 = circle1SizeValues[i];
        const v2 = circle2SizeValues[i];
        const total = v1 + v2;
        const outer = circleScale(total);
  // arc1
  const selId2 = this.options.dataPoints?.[i]?.selectionId as any;
  drawArc(ctx, x, y, 0, outer, 0, (v1/total) * 2*Math.PI, applyOpacity(circleOptions.color1, selectionOpacity(this.selectedIds, selId2, circleOptions.layer1Opacity)), circleOptions.strokeColor, circleOptions.strokeWidth);
        // arc2
  drawArc(ctx, x, y, 0, outer, (v1/total) * 2*Math.PI, 2*Math.PI, applyOpacity(circleOptions.color2, selectionOpacity(this.selectedIds, selId2, circleOptions.layer2Opacity)), circleOptions.strokeColor, circleOptions.strokeWidth);

        const [hx, hy] = d3Projection([longitudes[i], latitudes[i]]) as [number, number];
        const hit = hitLayer.append('circle')
          .attr('cx', hx)
          .attr('cy', hy)
          .attr('r', outer)
          .style('fill', 'transparent')
          .style('stroke', 'transparent')
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .datum(this.options.dataPoints?.[i]?.selectionId);
        if (this.options.dataPoints?.[i]?.tooltip) {
          this.options.tooltipServiceWrapper.addTooltip(
            hit as any,
            () => this.options.dataPoints?.[i]?.tooltip,
            () => this.options.dataPoints?.[i]?.selectionId,
            true
          );
        }
        hit.on('click', (event: MouseEvent) => {
          const selectionId = this.options.dataPoints?.[i]?.selectionId;
          const nativeEvent = event;
          this.options.selectionManager.select(selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
            .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { this.selectedIds = selectedIds; this.changed(); });
        });
      } else {
        // circle 1
        ctx.beginPath();
        ctx.arc(x, y, r1, 0, 2*Math.PI);
  const selId3 = this.options.dataPoints?.[i]?.selectionId as any;
  ctx.fillStyle = applyOpacity(circleOptions.color1, selectionOpacity(this.selectedIds, selId3, circleOptions.layer1Opacity));
  ctx.strokeStyle = circleOptions.strokeColor;
  ctx.lineWidth = Math.round(circleOptions.strokeWidth);
  ctx.fill();
  strokeAligned(ctx);

        if (circle2SizeValues.length > 0) {
          ctx.beginPath();
          ctx.arc(x, y, r2, 0, 2*Math.PI);
          ctx.fillStyle = applyOpacity(circleOptions.color2, selectionOpacity(this.selectedIds, selId3, circleOptions.layer2Opacity));
          ctx.strokeStyle = circleOptions.strokeColor;
          ctx.lineWidth = Math.round(circleOptions.strokeWidth);
          ctx.fill();
          strokeAligned(ctx);
        }

        const [hx, hy] = d3Projection([longitudes[i], latitudes[i]]) as [number, number];
        const hit = hitLayer.append('circle')
          .attr('cx', hx)
          .attr('cy', hy)
          .attr('r', Math.max(r1, r2))
          .style('fill', 'transparent')
          .style('stroke', 'transparent')
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .datum(this.options.dataPoints?.[i]?.selectionId);
        if (this.options.dataPoints?.[i]?.tooltip) {
          this.options.tooltipServiceWrapper.addTooltip(
            hit as any,
            () => this.options.dataPoints?.[i]?.tooltip,
            () => this.options.dataPoints?.[i]?.selectionId,
            true
          );
        }
        hit.on('click', (event: MouseEvent) => {
          const selectionId = this.options.dataPoints?.[i]?.selectionId;
          const nativeEvent = event;
          this.options.selectionManager.select(selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
            .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { this.selectedIds = selectedIds; this.changed(); });
        });
      }

      // Tooltip hookup: use invisible DOM hit-target overlay by syncing dataPoints to pixel rects (optional improvement)
      // For now, rely on Power BI tooltip wrapper with coordinate anchoring via SVG fallback if needed.
    }

    // Render labels on top of circles
    const { labelOptions, labelValues = [] } = this.options;
    if (labelOptions?.showLabels && labelValues.length > 0) {
      this.renderLabels(ctx, project, labelOptions, labelValues, longitudes, latitudes, circleScale, circle1SizeValues, circle2SizeValues, circleOptions);
    }

    return this.options.svgContainer;
  }

  /**
   * Render labels for circles on canvas
   */
  private renderLabels(
    ctx: CanvasRenderingContext2D,
    project: (lon: number, lat: number) => [number, number],
    options: CircleLabelOptions,
    labelValues: string[],
    longitudes: number[],
    latitudes: number[],
    circleScale: (v: number) => number,
    circle1SizeValues: number[],
    circle2SizeValues: number[],
    circleOptions: any
  ): void {
    const {
      fontSize = 12,
      fontColor = '#333333',
      fontFamily = 'sans-serif',
      position = 'center',
      showBackground = false,
      backgroundColor = '#ffffff',
      backgroundOpacity = 80,
      backgroundPadding = 4,
      backgroundBorderRadius = 0,
      showBorder = false,
      borderColor = '#cccccc',
      borderWidth = 1,
      showHalo = true,
      haloColor = '#ffffff',
      haloWidth = 2
    } = options;

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Disable blur/glow shadow effects for labels
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    for (let i = 0; i < longitudes.length; i++) {
      if (labelValues[i] === undefined || labelValues[i] === null || labelValues[i] === '') continue;
      
      const label = String(labelValues[i]);
      const [x, y] = project(longitudes[i], latitudes[i]);
      
      // Calculate radius for positioning
      const v1 = circle1SizeValues[i] ?? 0;
      const v2 = circle2SizeValues?.[i] ?? 0;
      const chartType = circleOptions.chartType;
      let radius: number;
      if (chartType === 'pie-chart' || chartType === 'donut-chart') {
        radius = circleScale(v1 + v2);
      } else if (circle2SizeValues?.length > 0) {
        radius = Math.max(circleScale(v1), circleScale(v2));
      } else {
        radius = circleScale(v1);
      }

      // Calculate label position
      let labelX = x;
      let labelY = y;
      let textAlign: CanvasTextAlign = 'center';
      let textBaseline: CanvasTextBaseline = 'middle';

      switch (position) {
        case 'above':
          labelY = y - radius - fontSize / 2 - 4;
          textBaseline = 'bottom';
          break;
        case 'below':
          labelY = y + radius + fontSize / 2 + 4;
          textBaseline = 'top';
          break;
        case 'left':
          labelX = x - radius - 4;
          textAlign = 'right';
          break;
        case 'right':
          labelX = x + radius + 4;
          textAlign = 'left';
          break;
        case 'center':
        default:
          break;
      }

      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;

      // Measure text for background
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      // Draw background if enabled
      if (showBackground) {
        const bgX = labelX - (textAlign === 'center' ? textWidth / 2 : textAlign === 'right' ? textWidth : 0) - backgroundPadding;
        const bgY = labelY - (textBaseline === 'middle' ? textHeight / 2 : textBaseline === 'bottom' ? textHeight : 0) - backgroundPadding;
        const bgWidth = textWidth + backgroundPadding * 2;
        const bgHeight = textHeight + backgroundPadding * 2;

        ctx.fillStyle = backgroundColor;
        ctx.globalAlpha = backgroundOpacity / 100;
        
        if (backgroundBorderRadius > 0) {
          this.roundRect(ctx, bgX, bgY, bgWidth, bgHeight, backgroundBorderRadius);
          ctx.fill();
        } else {
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        }

        if (showBorder) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = borderWidth;
          if (backgroundBorderRadius > 0) {
            this.roundRect(ctx, bgX, bgY, bgWidth, bgHeight, backgroundBorderRadius);
            ctx.stroke();
          } else {
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Draw text halo if enabled
      if (showHalo && haloWidth > 0) {
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(label, labelX, labelY);
      }

      // Draw text
      ctx.fillStyle = fontColor;
      ctx.fillText(label, labelX, labelY);
    }
  }

  /**
   * Draw a rounded rectangle path
   */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  setSelectedIds(selectionIds: powerbi.extensibility.ISelectionId[]) { this.selectedIds = selectionIds; }

  // Clean up DOM canvas element when layer is removed
  dispose() {
    const el = this.options.svgContainer.querySelector('#circles-canvas');
    if (el && el.parentElement) el.parentElement.removeChild(el);
  // Remove hit overlay group
  try { this.options.svg.select('#circles-hitlayer').remove(); } catch {}
  }

  // Provide spatial extent in map projection so orchestrators can fit the view
  getFeaturesExtent(): Extent | undefined {
    const longs = this.options.longitudes || [];
    const lats = this.options.latitudes || [];
    if (!longs.length || !lats.length) return undefined;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < Math.min(longs.length, lats.length); i++) {
      const x = longs[i];
      const y = lats[i];
      if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return undefined;
    const extent4326: Extent = [minX, minY, maxX, maxY] as any;
    return transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  }

  /**
   * Render H3 hexbin aggregated visualization on Canvas
   */
  private renderH3Hexbins(
    ctx: CanvasRenderingContext2D,
    frameState: FrameState,
    width: number,
    height: number
  ): void {
    const { longitudes = [], latitudes = [], circle1SizeValues = [], circleOptions } = this.options;
    const { 
      h3Resolution = 4, 
      h3AggregationType = 'sum',
      h3ColorRamp = 'viridis',
      h3FillColor = '#3182bd',
      h3StrokeColor = '#ffffff',
      h3StrokeWidth = 1,
      h3MinOpacity = 30,
      h3MaxOpacity = 90
    } = circleOptions;

    // Create D3 projection for coordinate conversion
    const d3Projection = createWebMercatorProjection(frameState, width, height);

    // Disable shadow effects for hexbins
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Aggregate points to H3 hexbins
    const hexbins = aggregateToH3Hexbins(
      longitudes,
      latitudes,
      circle1SizeValues.length > 0 ? circle1SizeValues : undefined,
      {
        resolution: h3Resolution,
        aggregationType: h3AggregationType as H3AggregationType
      }
    );

    if (hexbins.length === 0) return;

    // Calculate min/max values for color scaling
    const values = hexbins.map(h => h.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Prepare color options
    const colorOptions: H3ColorOptions = {
      colorRamp: h3ColorRamp as H3ColorRamp,
      customColor: h3FillColor,
      minOpacity: h3MinOpacity,
      maxOpacity: h3MaxOpacity
    };

    // Remove previous hit overlay
    this.options.svg.select('#circles-hitlayer').remove();
    const hitLayer = this.options.svg.append('g').attr('id', 'circles-hitlayer');
    hitLayer.style('pointer-events', 'all');

    // Render each hexbin as a polygon
    hexbins.forEach((hexbin: H3Hexbin) => {
      // Convert boundary from [lat, lng] to [lng, lat] and project
      const boundary = boundaryToLngLat(hexbin.boundary);
      const projectedBoundary = boundary.map(([lng, lat]) => d3Projection([lng, lat]));

      // Skip if any point fails projection
      if (projectedBoundary.some(p => p === null)) return;

      // Draw hexbin polygon on canvas
      ctx.beginPath();
      projectedBoundary.forEach((p, i) => {
        if (i === 0) {
          ctx.moveTo(p![0], p![1]);
        } else {
          ctx.lineTo(p![0], p![1]);
        }
      });
      ctx.closePath();

      // Get color based on value using color ramp (includes opacity)
      const fillColor = getHexbinColor(hexbin.value, minValue, maxValue, colorOptions);
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 1; // Opacity is already in fillColor
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = h3StrokeColor;
      ctx.lineWidth = h3StrokeWidth;
      ctx.stroke();

      // Create invisible SVG hit target for tooltip/selection
      const pathData = projectedBoundary
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p![0]},${p![1]}`)
        .join(' ') + ' Z';

      const hit = hitLayer.append('path')
        .attr('d', pathData)
        .style('fill', 'transparent')
        .style('stroke', 'transparent')
        .style('cursor', 'pointer')
        .style('pointer-events', 'all');

      // Add tooltip showing aggregated value
      if (this.options.tooltipServiceWrapper) {
        const aggregationLabel = h3AggregationType.charAt(0).toUpperCase() + h3AggregationType.slice(1);
        const tooltipData: powerbi.extensibility.VisualTooltipDataItem[] = [
          { displayName: aggregationLabel, value: hexbin.value.toLocaleString() },
          { displayName: 'Point Count', value: hexbin.count.toString() }
        ];

        this.options.tooltipServiceWrapper.addTooltip(
          hit as any,
          () => tooltipData,
          () => undefined,
          true
        );
      }

      // Click handler for selection
      if (hexbin.pointIndices.length > 0) {
        hit.on('click', (event: MouseEvent) => {
          const firstPointIndex = hexbin.pointIndices[0];
          const selectionId = this.options.dataPoints?.[firstPointIndex]?.selectionId;
          if (selectionId) {
            const nativeEvent = event;
            this.options.selectionManager.select(selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
              .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { 
                this.selectedIds = selectedIds; 
                this.changed(); 
              });
          }
        });
      }
    });
  }
}

function applyOpacity(hex: string, alpha: number) {
  // hex like #rrggbb
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  fillStyle: string,
  strokeStyle: string,
  lineWidth: number
) {
  ctx.beginPath();
  // Match d3-arc orientation: angles measured clockwise from 12 o'clock
  const a0 = startAngle - Math.PI / 2;
  const a1 = endAngle - Math.PI / 2;
  // For a pie slice (innerRadius = 0), draw from center -> outer start -> outer arc -> back to center
  if (innerRadius <= 0) {
    const sx = x + outerRadius * Math.cos(a0);
    const sy = y + outerRadius * Math.sin(a0);
    ctx.moveTo(x, y);
    ctx.lineTo(sx, sy);
    ctx.arc(x, y, outerRadius, a0, a1, false);
    ctx.lineTo(x, y);
  } else {
    // Donut slice: outer arc then inner arc in reverse to create the ring segment
    ctx.arc(x, y, outerRadius, a0, a1, false);
    ctx.arc(x, y, innerRadius, a1, a0, true);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  strokeAligned(ctx);
}

function strokeAligned(ctx: CanvasRenderingContext2D) {
  ctx.save();
  // Half-pixel alignment in CSS pixel space (post-DPR scaling)
  ctx.translate(0.5, 0.5);
  ctx.stroke();
  ctx.restore();
}
