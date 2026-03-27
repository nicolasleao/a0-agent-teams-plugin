(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    module.exports.default = api;
  } else if (root) {
    root.Pixeloids = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2.5.1';
  var VIEWBOX_SIZE = 100;
  var GRID_SIZE = 20;
  var CELL = VIEWBOX_SIZE / GRID_SIZE;

  var PALETTES = [
    {
      name: 'mint-chip',
      background: '#dcfce7',
      body: '#0f766e',
      head: '#86efac',
      accent: '#fef08a',
      detail: '#14532d',
      topper: '#1f2937',
      outline: '#172033'
    },
    {
      name: 'grape-soda',
      background: '#efe4ff',
      body: '#7c3aed',
      head: '#c4b5fd',
      accent: '#f9a8d4',
      detail: '#4c1d95',
      topper: '#3f2a56',
      outline: '#18112b'
    },
    {
      name: 'sunny-day',
      background: '#fef3c7',
      body: '#f97316',
      head: '#fdba74',
      accent: '#fb7185',
      detail: '#9a3412',
      topper: '#4b2e1f',
      outline: '#2f1d13'
    },
    {
      name: 'bubblegum',
      background: '#ffe4ef',
      body: '#db2777',
      head: '#f9a8d4',
      accent: '#fde68a',
      detail: '#9d174d',
      topper: '#6b214a',
      outline: '#2b1624'
    },
    {
      name: 'ocean-pop',
      background: '#dbeafe',
      body: '#2563eb',
      head: '#7dd3fc',
      accent: '#a7f3d0',
      detail: '#1d4ed8',
      topper: '#1e3a8a',
      outline: '#10203b'
    },
    {
      name: 'matcha-latte',
      background: '#ecfccb',
      body: '#65a30d',
      head: '#bef264',
      accent: '#fdba74',
      detail: '#3f6212',
      topper: '#44551d',
      outline: '#1c2714'
    }
  ];

  var SHARED_EYE_SHAPES = ['dots', 'wide', 'blink', 'tall', 'wink'];
  var SHARED_MOUTH_SHAPES = ['smile', 'flat', 'open', 'smirk', 'grin'];

  function xmur3(input) {
    var h = 1779033703 ^ input.length;
    for (var i = 0; i < input.length; i += 1) {
      h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seedString) {
    return mulberry32(xmur3(seedString)());
  }

  function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
  }

  function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSeed(seed) {
    if (seed === undefined || seed === null || seed === '') {
      return 'pixeloid';
    }
    return String(seed);
  }

  function normalizeVariant(variant) {
    if (variant === undefined || variant === null || variant === '') {
      return 'monster';
    }
    return String(variant).toLowerCase();
  }

  function normalizeOptions(options) {
    var source = options || {};
    var size = typeof source.size === 'number' && isFinite(source.size) && source.size > 0 ? source.size : 128;
    var margin = typeof source.margin === 'number' && isFinite(source.margin) && source.margin >= 0 ? source.margin : 0;
    var safeMargin = Math.min(margin, Math.floor(VIEWBOX_SIZE / 2) - 1);

    return {
      size: size,
      background: source.background !== false,
      margin: safeMargin,
      title: source.title ? String(source.title) : '',
      transparentBackground: source.transparentBackground === true,
      variant: normalizeVariant(source.variant)
    };
  }

  /**
   * Base class for avatar renderers. Subclasses override render(seed, options)
   * and return { svg: string, metadata: object }.
   */
  function AvatarProvider() {}

  AvatarProvider.prototype.render = function () {
    throw new Error('AvatarProvider#render must be implemented by subclass');
  };

  var VARIANT_REGISTRY = {};

  function registerVariant(name, ProviderClass) {
    VARIANT_REGISTRY[normalizeVariant(name)] = ProviderClass;
  }

  function getProvider(variant) {
    var key = normalizeVariant(variant);
    var Ctor = VARIANT_REGISTRY[key];
    if (!Ctor) {
      throw new Error(
        'Unknown pixeloids variant: "' +
          key +
          '". Known variants: ' +
          Object.keys(VARIANT_REGISTRY).join(', ')
      );
    }
    return new Ctor();
  }

  function createRect(x, y, width, height, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" fill="' + fill + '"/>';
  }

  function cellRect(x, y, w, h, fill) {
    return createRect(x * CELL, y * CELL, w * CELL, h * CELL, fill);
  }

  function addPart(parts, x, y, w, h, fill) {
    if (w <= 0 || h <= 0) {
      return;
    }
    parts.push(cellRect(x, y, w, h, fill));
  }

  function buildBackground(traits, palette, options) {
    if (!options.background || options.transparentBackground) {
      return '';
    }

    var accent = traits.backgroundAccent;
    var shapes = [
      createRect(options.margin, options.margin, VIEWBOX_SIZE - options.margin * 2, VIEWBOX_SIZE - options.margin * 2, palette.background)
    ];

    var scale = VIEWBOX_SIZE / 64;
    var px = function (value) {
      return Math.round(value * scale);
    };

    if (accent === 'dots') {
      shapes.push(createRect(px(16), px(16), px(4), px(4), 'rgba(255,255,255,0.45)'));
      shapes.push(createRect(px(44), px(12), px(4), px(4), 'rgba(255,255,255,0.45)'));
      shapes.push(createRect(px(12), px(44), px(4), px(4), 'rgba(255,255,255,0.45)'));
    } else if (accent === 'steps') {
      shapes.push(createRect(px(8), px(12), px(12), px(4), 'rgba(255,255,255,0.35)'));
      shapes.push(createRect(px(44), px(44), px(12), px(4), 'rgba(255,255,255,0.35)'));
    } else {
      shapes.push(createRect(px(8), px(8), px(12), px(12), 'rgba(255,255,255,0.22)'));
      shapes.push(createRect(px(44), px(44), px(8), px(8), 'rgba(255,255,255,0.22)'));
    }

    return shapes.join('');
  }

  function buildBody(traits, palette) {
    var x = traits.bodyX;
    var y = traits.bodyY;
    var w = traits.bodyWidth;
    var h = traits.bodyHeight;
    var parts = [];

    if (traits.bodyShape === 'block') {
      addPart(parts, x, y, w, h, palette.body);
    } else if (traits.bodyShape === 'taper') {
      addPart(parts, x, y, w, Math.min(2, h), palette.body);
      addPart(parts, x + 1, y + 2, w - 2, h - 2, palette.body);
    } else if (traits.bodyShape === 'chonk') {
      addPart(parts, x + 1, y, w - 2, 1, palette.body);
      addPart(parts, x, y + 1, w, h - 1, palette.body);
    } else {
      addPart(parts, x + 1, y, w - 2, 1, palette.body);
      addPart(parts, x, y + 1, w, h - 2, palette.body);
      addPart(parts, x + 1, y + h - 1, w - 2, 1, palette.body);
    }

    if (traits.bellyStyle === 'panel') {
      addPart(parts, x + 2, y + 2, w - 4, Math.max(2, h - 4), palette.head);
    } else if (traits.bellyStyle === 'stripe') {
      addPart(parts, x + Math.floor(w / 2) - 1, y + 1, 2, h - 2, palette.head);
    } else if (traits.bellyStyle === 'core') {
      addPart(parts, x + Math.floor(w / 2) - 1, y + 2, 2, 2, palette.accent);
      addPart(parts, x + Math.floor(w / 2) - 2, y + 3, 4, 2, palette.accent);
    }

    return parts.join('');
  }

  function buildHead(traits, palette) {
    var x = traits.headX;
    var y = traits.headY;
    var w = traits.headWidth;
    var h = traits.headHeight;
    var parts = [];

    if (traits.headShape === 'square') {
      addPart(parts, x, y, w, h, palette.head);
    } else if (traits.headShape === 'tall') {
      addPart(parts, x + 1, y, w - 2, 1, palette.head);
      addPart(parts, x, y + 1, w, h - 1, palette.head);
    } else if (traits.headShape === 'wide') {
      addPart(parts, x, y, w, h - 1, palette.head);
      addPart(parts, x + 1, y + h - 1, w - 2, 1, palette.head);
    } else {
      addPart(parts, x + 1, y, w - 2, 1, palette.head);
      addPart(parts, x, y + 1, w, h - 2, palette.head);
      addPart(parts, x + 1, y + h - 1, w - 2, 1, palette.head);
    }

    if (traits.cheekStyle === 'dots') {
      addPart(parts, x + 1, traits.mouthTopY, 1, 1, palette.accent);
      addPart(parts, x + w - 2, traits.mouthTopY, 1, 1, palette.accent);
    } else if (traits.cheekStyle === 'bars') {
      var cheekY = traits.eyeY + 1;
      var cheekHeight = Math.max(1, traits.mouthTopY - cheekY);
      addPart(parts, x + 1, cheekY, 1, cheekHeight, palette.accent);
      addPart(parts, x + w - 2, cheekY, 1, cheekHeight, palette.accent);
    }

    return parts.join('');
  }

  function buildTopper(traits, palette) {
    var x = traits.headX;
    var y = traits.headY;
    var w = traits.headWidth;
    var parts = [];

    if (traits.topperStyle === 'none') {
      return '';
    }

    if (traits.topperStyle === 'horns') {
      addPart(parts, x + 1, y - 2, 2, 2, palette.topper);
      addPart(parts, x + w - 3, y - 2, 2, 2, palette.topper);
      addPart(parts, x + 2, y - 1, 1, 1, palette.accent);
      addPart(parts, x + w - 3, y - 1, 1, 1, palette.accent);
    } else if (traits.topperStyle === 'ears') {
      addPart(parts, x, y - 2, 2, 2, palette.topper);
      addPart(parts, x + w - 2, y - 2, 2, 2, palette.topper);
      addPart(parts, x + 1, y - 1, 1, 1, palette.accent);
      addPart(parts, x + w - 2, y - 1, 1, 1, palette.accent);
    } else if (traits.topperStyle === 'antenna') {
      addPart(parts, x + Math.floor(w / 2), y - 1, 1, 1, palette.topper);
      addPart(parts, x + Math.floor(w / 2) - 1, y - 2, 3, 1, palette.accent);
    } else if (traits.topperStyle === 'sprout') {
      addPart(parts, x + Math.floor(w / 2), y - 1, 1, 1, palette.topper);
      addPart(parts, x + Math.floor(w / 2) - 2, y - 2, 2, 1, palette.accent);
      addPart(parts, x + Math.floor(w / 2) + 1, y - 2, 2, 1, palette.accent);
    } else if (traits.topperStyle === 'tuft') {
      addPart(parts, x + 2, y - 1, w - 4, 1, palette.topper);
      addPart(parts, x + Math.floor(w / 2) - 1, y - 2, 2, 1, palette.topper);
    } else {
      addPart(parts, x + 1, y - 2, w - 2, 2, palette.topper);
      addPart(parts, x + 2, y, w - 4, 1, palette.topper);
    }

    return parts.join('');
  }

  function drawFaceParts(parts, anchor, faceStyle, colors, addRect) {
    if (faceStyle.eyes === 'dots') {
      addRect(parts, anchor.leftX, anchor.eyeY, 1, 1, colors.ink);
      addRect(parts, anchor.rightX, anchor.eyeY, 1, 1, colors.ink);
    } else if (faceStyle.eyes === 'wide') {
      addRect(parts, anchor.leftX, anchor.eyeY, 2, 1, colors.white);
      addRect(parts, anchor.rightX - 1, anchor.eyeY, 2, 1, colors.white);
      addRect(parts, anchor.leftX, anchor.eyeY, 1, 1, colors.ink);
      addRect(parts, anchor.rightX, anchor.eyeY, 1, 1, colors.ink);
    } else if (faceStyle.eyes === 'blink') {
      addRect(parts, anchor.leftX, anchor.eyeY, 2, 1, colors.ink);
      addRect(parts, anchor.rightX - 1, anchor.eyeY, 2, 1, colors.ink);
    } else if (faceStyle.eyes === 'wink') {
      if (anchor.winkSide === 'right') {
        addRect(parts, anchor.leftX, anchor.eyeY, 1, 1, colors.ink);
        addRect(parts, anchor.rightX - 1, anchor.eyeY, 2, 1, colors.ink);
      } else {
        addRect(parts, anchor.leftX, anchor.eyeY, 2, 1, colors.ink);
        addRect(parts, anchor.rightX, anchor.eyeY, 1, 1, colors.ink);
      }
    } else {
      addRect(parts, anchor.leftX, anchor.eyeY, 1, 2, colors.white);
      addRect(parts, anchor.rightX, anchor.eyeY, 1, 2, colors.white);
      addRect(parts, anchor.leftX, anchor.eyeY, 1, 1, colors.ink);
      addRect(parts, anchor.rightX, anchor.eyeY, 1, 1, colors.ink);
    }

    if (faceStyle.mouth === 'smile') {
      addRect(parts, anchor.mouthX - 1, anchor.mouthY, 4, 1, colors.ink);
      addRect(parts, anchor.mouthX - 1, anchor.mouthY - 1, 1, 1, colors.ink);
      addRect(parts, anchor.mouthX + 2, anchor.mouthY - 1, 1, 1, colors.ink);
    } else if (faceStyle.mouth === 'flat') {
      addRect(parts, anchor.mouthX, anchor.mouthY, 2, 1, colors.ink);
    } else if (faceStyle.mouth === 'open') {
      addRect(parts, anchor.mouthX, anchor.mouthY, 2, 2, colors.ink);
      addRect(parts, anchor.mouthX, anchor.mouthY + 1, 2, 1, colors.accent);
    } else if (faceStyle.mouth === 'grin') {
      addRect(parts, anchor.mouthX - 1, anchor.mouthY, 4, 1, colors.ink);
      addRect(parts, anchor.mouthX, anchor.mouthY, 1, 1, colors.white);
      addRect(parts, anchor.mouthX + 1, anchor.mouthY, 1, 1, colors.white);
    } else {
      addRect(parts, anchor.mouthX - 1, anchor.mouthY, 3, 1, colors.ink);
      addRect(parts, anchor.mouthX + 1, anchor.mouthY - 1, 1, 1, colors.ink);
    }
  }

  function buildFace(traits, palette) {
    var parts = [];
    drawFaceParts(
      parts,
      {
        leftX: traits.faceLeftX,
        rightX: traits.faceRightX,
        eyeY: traits.eyeY,
        mouthX: traits.mouthX,
        mouthY: traits.mouthY,
        winkSide: traits.winkSide
      },
      traits.faceStyle,
      { ink: palette.outline, white: '#ffffff', accent: palette.accent },
      addPart
    );
    return parts.join('');
  }

  function buildLimbs(traits, palette) {
    var x = traits.bodyX;
    var y = traits.bodyY;
    var w = traits.bodyWidth;
    var h = traits.bodyHeight;
    var parts = [];

    if (traits.armStyle === 'stub') {
      addPart(parts, x - 1, y + 2, 1, 2, palette.body);
      addPart(parts, x + w, y + 2, 1, 2, palette.body);
    } else if (traits.armStyle === 'down') {
      addPart(parts, x - 1, y + 1, 1, 4, palette.body);
      addPart(parts, x + w, y + 1, 1, 4, palette.body);
    } else {
      addPart(parts, x - 2, y + 2, 2, 1, palette.body);
      addPart(parts, x + w, y + 2, 2, 1, palette.body);
      addPart(parts, x - 2, y + 3, 1, 1, palette.body);
      addPart(parts, x + w + 1, y + 3, 1, 1, palette.body);
    }

    if (traits.legStyle === 'short') {
      addPart(parts, x + 1, y + h, 1, 1, palette.body);
      addPart(parts, x + w - 2, y + h, 1, 1, palette.body);
    } else if (traits.legStyle === 'wide') {
      addPart(parts, x + 1, y + h, 2, 1, palette.body);
      addPart(parts, x + w - 3, y + h, 2, 1, palette.body);
    } else {
      addPart(parts, x + 2, y + h, 1, 2, palette.body);
      addPart(parts, x + w - 3, y + h, 1, 2, palette.body);
    }

    return parts.join('');
  }

  /**
   * Vertical extent of the figure in grid rows (0..GRID_SIZE-1), inclusive.
   * Used to translate the character so it is centered in the viewBox.
   */
  function computeVerticalOffsetGrid(traits) {
    var headY = traits.headY;
    var headH = traits.headHeight;
    var bodyY = traits.bodyY;
    var bodyH = traits.bodyHeight;

    var minY = traits.topperStyle === 'none' ? headY : headY - 2;

    var maxY = bodyY + bodyH - 1;

    var legMax = bodyY + bodyH;
    if (traits.legStyle === 'long') {
      legMax = bodyY + bodyH + 1;
    }
    if (legMax > maxY) {
      maxY = legMax;
    }

    var armMax = bodyY;
    if (traits.armStyle === 'stub') {
      armMax = bodyY + 3;
    } else if (traits.armStyle === 'down') {
      armMax = bodyY + 4;
    } else {
      armMax = bodyY + 3;
    }
    if (armMax > maxY) {
      maxY = armMax;
    }

    if (traits.mouthStyle === 'open' && traits.mouthY + 1 > maxY) {
      maxY = traits.mouthY + 1;
    }
    if (traits.eyeStyle === 'tall' && traits.eyeY + 1 > maxY) {
      maxY = traits.eyeY + 1;
    }

    var contentHeight = maxY - minY + 1;
    return Math.floor((GRID_SIZE - contentHeight) / 2) - minY;
  }

  function generateTraits(seed, options) {
    var normalizedSeed = normalizeSeed(seed);
    var normalizedOptions = normalizeOptions(options);
    var rng = createRng(normalizedSeed + '|' + VERSION);
    var palette = pick(rng, PALETTES);
    var headWidth = pick(rng, [9, 10, 11, 12]);
    var headHeight = pick(rng, [7, 8, 9]);
    var bodyWidth = pick(rng, [8, 9, 10, 11]);
    var bodyHeight = pick(rng, [5, 6, 7]);
    var headX = Math.floor((GRID_SIZE - headWidth) / 2);
    var headY = 2;
    var bodyX = Math.floor((GRID_SIZE - bodyWidth) / 2);
    var bodyY = headY + headHeight;
    var eyeStyle = pick(rng, SHARED_EYE_SHAPES);
    var mouthStyle = pick(rng, SHARED_MOUTH_SHAPES);
    var faceStyle = { eyes: eyeStyle, mouth: mouthStyle };
    var mouthY = headY + headHeight - 2;
    var mouthTopY = mouthY - (mouthStyle === 'smile' || mouthStyle === 'smirk' ? 1 : 0);
    var eyeY = headY + 1;

    if (eyeStyle === 'tall' && mouthTopY <= eyeY + 2) {
      eyeY = Math.max(headY, eyeY - 1);
    }

    var faceLeftX = headX + 2;
    var faceRightX = headX + headWidth - 3;

    if ((eyeStyle === 'wide' || eyeStyle === 'blink') && faceRightX - faceLeftX < 4) {
      faceLeftX = headX + 1;
      faceRightX = headX + headWidth - 2;
    }

    var mouthX = headX + Math.floor(headWidth / 2) - 1;

    return {
      seed: normalizedSeed,
      options: normalizedOptions,
      palette: palette,
      backgroundStyle: 'square',
      backgroundAccent: pick(rng, ['dots', 'steps', 'blocks']),
      headShape: pick(rng, ['square', 'tall', 'wide', 'helmet']),
      headX: headX,
      headY: headY,
      headWidth: headWidth,
      headHeight: headHeight,
      bodyShape: pick(rng, ['block', 'taper', 'chonk', 'tiny']),
      bodyX: bodyX,
      bodyY: bodyY,
      bodyWidth: bodyWidth,
      bodyHeight: bodyHeight,
      topperStyle: pick(rng, ['none', 'horns', 'ears', 'antenna', 'sprout', 'tuft', 'cap']),
      eyeStyle: eyeStyle,
      eyeY: eyeY,
      faceLeftX: faceLeftX,
      faceRightX: faceRightX,
      mouthX: mouthX,
      mouthY: mouthY,
      mouthTopY: mouthTopY,
      faceStyle: faceStyle,
      winkSide: pick(rng, ['left', 'right']),
      mouthStyle: mouthStyle,
      armStyle: pick(rng, ['stub', 'down', 'up']),
      legStyle: pick(rng, ['short', 'wide', 'long']),
      bellyStyle: pick(rng, ['none', 'panel', 'stripe', 'core']),
      cheekStyle: pick(rng, ['none', 'dots', 'bars'])
    };
  }

  function selectUnifiedPalette(seed) {
    var rng = createRng(normalizeSeed(seed) + '|' + VERSION);
    return pick(rng, PALETTES);
  }

  function buildMonsterMetadata(traits) {
    return {
      variant: 'monster',
      seed: traits.seed,
      size: traits.options.size,
      palette: traits.palette.name,
      colors: {
        background: traits.palette.background,
        body: traits.palette.body,
        head: traits.palette.head,
        accent: traits.palette.accent,
        detail: traits.palette.detail,
        topper: traits.palette.topper,
        outline: traits.palette.outline
      },
      traits: {
        backgroundStyle: traits.backgroundStyle,
        backgroundAccent: traits.backgroundAccent,
        headShape: traits.headShape,
        headWidth: traits.headWidth,
        headHeight: traits.headHeight,
        bodyShape: traits.bodyShape,
        bodyWidth: traits.bodyWidth,
        bodyHeight: traits.bodyHeight,
        topperStyle: traits.topperStyle,
        eyeStyle: traits.eyeStyle,
        mouthStyle: traits.mouthStyle,
        winkSide: traits.winkSide,
        armStyle: traits.armStyle,
        legStyle: traits.legStyle,
        bellyStyle: traits.bellyStyle,
        cheekStyle: traits.cheekStyle
      },
      viewBox: '0 0 ' + VIEWBOX_SIZE + ' ' + VIEWBOX_SIZE
    };
  }

  function MonsterAvatarProvider() {}
  MonsterAvatarProvider.prototype = Object.create(AvatarProvider.prototype);
  MonsterAvatarProvider.prototype.constructor = MonsterAvatarProvider;
  MonsterAvatarProvider.prototype.render = function (seed, options) {
    var traits = generateTraits(seed, options);
    var normalizedOptions = traits.options;
    var title = normalizedOptions.title || 'Pixeloid: ' + traits.seed;
    var offsetY = computeVerticalOffsetGrid(traits) * CELL;
    var character =
      '<g transform="translate(0,' + offsetY + ')">' +
      buildBody(traits, traits.palette) +
      buildHead(traits, traits.palette) +
      buildTopper(traits, traits.palette) +
      buildFace(traits, traits.palette) +
      buildLimbs(traits, traits.palette) +
      '</g>';

    var svg =
      '' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      normalizedOptions.size +
      '" height="' +
      normalizedOptions.size +
      '" viewBox="0 0 ' +
      VIEWBOX_SIZE +
      ' ' +
      VIEWBOX_SIZE +
      '" role="img" aria-label="' +
      escapeXml(title) +
      '" shape-rendering="crispEdges">' +
      '<title>' +
      escapeXml(title) +
      '</title>' +
      buildBackground(traits, traits.palette, normalizedOptions) +
      character +
      '</svg>';

    return { svg: svg, metadata: buildMonsterMetadata(traits) };
  };

  // --- Minimal variant: pixel portraits ---

  function hashNameMinimal(name) {
    var hash = 5381;
    var i;
    for (i = 0; i < name.length; i += 1) {
      hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function minimalBackgroundPresets() {
    return [
      function (bg, accent, s) {
        return cellRect(0, 0, GRID_SIZE, GRID_SIZE, bg);
      },
      function (bg, accent, s) {
        return cellRect(0, 0, GRID_SIZE, GRID_SIZE, bg) + cellRect(Math.floor(GRID_SIZE / 2), 0, Math.ceil(GRID_SIZE / 2), GRID_SIZE, accent);
      },
      function (bg, accent, s) {
        return cellRect(0, 0, GRID_SIZE, GRID_SIZE, bg) + cellRect(0, Math.floor(GRID_SIZE / 2), GRID_SIZE, Math.ceil(GRID_SIZE / 2), accent);
      },
      function (bg, accent, s) {
        var out = cellRect(0, 0, GRID_SIZE, GRID_SIZE, bg);
        var y;
        for (y = 0; y < GRID_SIZE; y += 1) {
          out += cellRect(y, y, GRID_SIZE - y, 1, accent);
        }
        return out;
      },
      function (bg, accent, s) {
        var out = cellRect(0, 0, GRID_SIZE, GRID_SIZE, bg);
        var x;
        var y;
        var dx;
        var dy;
        var cx = 0;
        var cy = GRID_SIZE;
        var r = Math.floor(GRID_SIZE * 0.7);
        for (y = 0; y < GRID_SIZE; y += 1) {
          for (x = 0; x < GRID_SIZE; x += 1) {
            dx = x + 0.5 - cx;
            dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r * r) {
              out += cellRect(x, y, 1, 1, accent);
            }
          }
        }
        return out;
      },
      function (bg, accent, s) {
        var out = cellRect(0, 0, GRID_SIZE, GRID_SIZE, accent);
        var inset = Math.floor(GRID_SIZE / 6);
        var size = GRID_SIZE - inset * 2;
        out += cellRect(inset, inset, size, size, bg);
        out += cellRect(inset, inset, 2, 2, accent);
        out += cellRect(inset + size - 2, inset, 2, 2, accent);
        out += cellRect(inset, inset + size - 2, 2, 2, accent);
        out += cellRect(inset + size - 2, inset + size - 2, 2, 2, accent);
        return out;
      }
    ];
  }
  function buildMinimalFace(faceStyle, faceColor, accentColor) {
    var parts = [];
    var anchor = {
      leftX: 6 + faceStyle.faceXShift,
      rightX: 13 + faceStyle.faceXShift,
      eyeY: 7 + faceStyle.eyeYShift,
      mouthX: 9 + faceStyle.faceXShift,
      mouthY: 12 + faceStyle.mouthYShift,
      winkSide: faceStyle.winkSide
    };

    drawFaceParts(
      parts,
      anchor,
      faceStyle,
      { ink: faceColor, white: MINIMAL_FEATURE_LIGHT, accent: accentColor },
      function (target, x, y, w, h, fill) {
        target.push(cellRect(x, y, w, h, fill));
      }
    );

    // Keep minimal style, but add subtle trait richness borrowed from monster.
    if (faceStyle.cheekStyle === 'dots') {
      parts.push(cellRect(anchor.leftX - 1, anchor.mouthY, 1, 1, accentColor));
      parts.push(cellRect(anchor.rightX + 1, anchor.mouthY, 1, 1, accentColor));
    } else if (faceStyle.cheekStyle === 'bars') {
      parts.push(cellRect(anchor.leftX - 1, anchor.eyeY + 1, 1, 2, accentColor));
      parts.push(cellRect(anchor.rightX + 1, anchor.eyeY + 1, 1, 2, accentColor));
    }

    if (faceStyle.browStyle === 'flat') {
      parts.push(cellRect(anchor.leftX - 1, anchor.eyeY - 1, 2, 1, faceColor));
      parts.push(cellRect(anchor.rightX, anchor.eyeY - 1, 2, 1, faceColor));
    } else if (faceStyle.browStyle === 'angry') {
      parts.push(cellRect(anchor.leftX - 1, anchor.eyeY - 1, 1, 1, faceColor));
      parts.push(cellRect(anchor.leftX, anchor.eyeY - 2, 1, 1, faceColor));
      parts.push(cellRect(anchor.rightX + 1, anchor.eyeY - 1, 1, 1, faceColor));
      parts.push(cellRect(anchor.rightX, anchor.eyeY - 2, 1, 1, faceColor));
    }

    return parts.join('');
  }

  function minimalUsesWhiteFeatures(faceStyle) {
    return faceStyle.eyes === 'wide' || faceStyle.eyes === 'tall' || faceStyle.mouth === 'grin';
  }

  function resolveMinimalColors(palette, faceStyle) {
    var usesWhite = minimalUsesWhiteFeatures(faceStyle);
    return {
      // Keep minimal backgrounds in the same palette family as monster:
      // light base + mid tone accent by default, darker pair when white details are used.
      background: usesWhite ? palette.detail : palette.background,
      accent: usesWhite ? palette.body : palette.head
    };
  }

  var MINIMAL_FACE_COLOR = '#172033';
  var MINIMAL_FEATURE_LIGHT = '#fff';
  var _minimalBgPresets = minimalBackgroundPresets();

  function MinimalAvatarProvider() {}
  MinimalAvatarProvider.prototype = Object.create(AvatarProvider.prototype);
  MinimalAvatarProvider.prototype.constructor = MinimalAvatarProvider;
  MinimalAvatarProvider.prototype.render = function (seed, options) {
    var opts = normalizeOptions(options);
    var normalizedSeed = normalizeSeed(seed);
    var name = normalizedSeed;
    var hash = hashNameMinimal(name);
    var s = opts.size;
    var palette = selectUnifiedPalette(normalizedSeed);
    var faceStyle = {
      eyes: SHARED_EYE_SHAPES[(hash >>> 12) % SHARED_EYE_SHAPES.length],
      mouth: SHARED_MOUTH_SHAPES[(hash >>> 16) % SHARED_MOUTH_SHAPES.length],
      winkSide: ((hash >>> 20) & 1) === 1 ? 'right' : 'left',
      cheekStyle: ['none', 'dots', 'bars'][(hash >>> 21) % 3],
      browStyle: ['none', 'flat', 'angry'][(hash >>> 23) % 3],
      faceXShift: [-1, 0, 1][(hash >>> 25) % 3],
      eyeYShift: [0, 1][(hash >>> 27) % 2],
      mouthYShift: [0, 1][(hash >>> 28) % 2]
    };
    var minimalColors = resolveMinimalColors(palette, faceStyle);
    var bg = minimalColors.background;
    var accent = minimalColors.accent;

    var bgPresetIdx = (hash >>> 4) % _minimalBgPresets.length;
    var bgSvg = _minimalBgPresets[bgPresetIdx](bg, accent, s);
    var faceSvg = buildMinimalFace(faceStyle, MINIMAL_FACE_COLOR, accent);

    var title = opts.title || 'Pixeloid: ' + normalizedSeed;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 ' +
      VIEWBOX_SIZE +
      ' ' +
      VIEWBOX_SIZE +
      '" role="img" aria-label="' +
      escapeXml(title) +
      '" shape-rendering="crispEdges">' +
      '<title>' +
      escapeXml(title) +
      '</title>' +
      bgSvg +
      faceSvg +
      '</svg>';

    var metadata = {
      variant: 'minimal',
      seed: normalizedSeed,
      size: opts.size,
      palette: palette.name,
      colors: {
        background: bg,
        accent: accent,
        face: MINIMAL_FACE_COLOR,
        body: palette.body,
        head: palette.head,
        detail: palette.detail,
        topper: palette.topper,
        outline: palette.outline
      },
      traits: {
        backgroundPreset: bgPresetIdx,
        faceEyes: faceStyle.eyes,
        faceMouth: faceStyle.mouth,
        winkSide: faceStyle.winkSide,
        cheekStyle: faceStyle.cheekStyle,
        browStyle: faceStyle.browStyle,
        faceXShift: faceStyle.faceXShift,
        eyeYShift: faceStyle.eyeYShift,
        mouthYShift: faceStyle.mouthYShift,
        paletteIndex: PALETTES.indexOf(palette)
      },
      viewBox: '0 0 ' + VIEWBOX_SIZE + ' ' + VIEWBOX_SIZE
    };

    return { svg: svg, metadata: metadata };
  };

  registerVariant('monster', MonsterAvatarProvider);
  registerVariant('minimal', MinimalAvatarProvider);

  function getMetadata(seed, options) {
    var opts = normalizeOptions(options);
    return getProvider(opts.variant).render(seed, opts).metadata;
  }

  function createSvg(seed, options) {
    var opts = normalizeOptions(options);
    return getProvider(opts.variant).render(seed, opts).svg;
  }

  function createAvatar(seed, options) {
    var opts = normalizeOptions(options);
    var result = getProvider(opts.variant).render(seed, opts);
    return {
      seed: normalizeSeed(seed),
      svg: result.svg,
      metadata: result.metadata
    };
  }

  function toDataUri(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  return {
    version: VERSION,
    AvatarProvider: AvatarProvider,
    MonsterAvatarProvider: MonsterAvatarProvider,
    MinimalAvatarProvider: MinimalAvatarProvider,
    registerVariant: registerVariant,
    createSvg: createSvg,
    getMetadata: getMetadata,
    createAvatar: createAvatar,
    toDataUri: toDataUri
  };
});
