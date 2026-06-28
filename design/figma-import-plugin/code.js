const ROOT_URL = "https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/";

const COLORS = {
  bg: { r: 17 / 255, g: 16 / 255, b: 15 / 255 },
  panel: { r: 29 / 255, g: 27 / 255, b: 24 / 255 },
  panel2: { r: 20 / 255, g: 20 / 255, b: 18 / 255 },
  copper: { r: 184 / 255, g: 106 / 255, b: 51 / 255 },
  text: { r: 246 / 255, g: 241 / 255, b: 234 / 255 },
  muted: { r: 173 / 255, g: 162 / 255, b: 148 / 255 },
  line: { r: 85 / 255, g: 58 / 255, b: 36 / 255 }
};

const HOME = {
  pageName: "Home Pack v1 - Imported",
  boardName: "Bourbon Hunters / Home Asset Pack v1",
  subtitle: "Home screen asset pack / real PNG assets imported from GitHub Pages",
  folder: "asset-pack-v1",
  board: { w: 1780, h: 2110 },
  sections: [
    { title: "0. Original Source Board", x: 44, y: 244, w: 820, h: 586, assets: [
      { name: "source-board-preview.jpg", w: 1536, h: 1024, x: 18, y: 58, cardW: 784, cardH: 500 }
    ]},
    { title: "1. Header", x: 900, y: 244, w: 820, h: 330, assets: [
      { name: "brand-lockup.png", w: 290, h: 170, x: 18, y: 62, cardW: 210, cardH: 210 },
      { name: "header.png", w: 600, h: 163, x: 244, y: 62, cardW: 390, cardH: 210 },
      { name: "logo.png", w: 188, h: 188, x: 650, y: 62, cardW: 150, cardH: 210 }
    ]},
    { title: "1b. Header Controls", x: 900, y: 604, w: 820, h: 230, assets: [
      { name: "notification.png", w: 131, h: 131, x: 18, y: 62, cardW: 180, cardH: 130 },
      { name: "language.png", w: 131, h: 131, x: 216, y: 62, cardW: 180, cardH: 130 },
      { name: "color-palette.png", w: 420, h: 74, x: 414, y: 62, cardW: 370, cardH: 130 }
    ]},
    { title: "2. Search", x: 44, y: 870, w: 820, h: 260, assets: [
      { name: "search-bar.png", w: 410, h: 80, x: 18, y: 62, cardW: 520, cardH: 150 },
      { name: "search-icon-tile.png", w: 82, h: 93, x: 558, y: 62, cardW: 180, cardH: 150 }
    ]},
    { title: "3. Featured + Badges", x: 900, y: 870, w: 820, h: 360, assets: [
      { name: "featured-card.png", w: 530, h: 252, x: 18, y: 62, cardW: 500, cardH: 250 },
      { name: "type-badges.png", w: 304, h: 230, x: 538, y: 62, cardW: 250, cardH: 250 }
    ]},
    { title: "4. Categories + Icons", x: 44, y: 1166, w: 820, h: 310, assets: [
      { name: "category-cards.png", w: 525, h: 148, x: 18, y: 62, cardW: 380, cardH: 190 },
      { name: "icon-set.png", w: 760, h: 74, x: 418, y: 62, cardW: 370, cardH: 190 }
    ]},
    { title: "5. Navigation + Buttons", x: 900, y: 1266, w: 820, h: 310, assets: [
      { name: "bottom-nav.png", w: 532, h: 78, x: 18, y: 62, cardW: 370, cardH: 150 },
      { name: "scan-button.png", w: 97, h: 98, x: 408, y: 62, cardW: 160, cardH: 150 },
      { name: "buttons.png", w: 704, h: 44, x: 18, y: 222, cardW: 770, cardH: 70 }
    ]},
    { title: "6. Effects + Decorative", x: 44, y: 1516, w: 1676, h: 500, assets: [
      { name: "glow.png", w: 169, h: 58, x: 18, y: 62, cardW: 220, cardH: 170 },
      { name: "smoke.png", w: 168, h: 58, x: 254, y: 62, cardW: 220, cardH: 170 },
      { name: "embers.png", w: 168, h: 58, x: 490, y: 62, cardW: 220, cardH: 170 },
      { name: "noise-overlay.png", w: 168, h: 58, x: 726, y: 62, cardW: 220, cardH: 170 },
      { name: "divider.png", w: 402, h: 40, x: 962, y: 62, cardW: 220, cardH: 170 },
      { name: "stamp.png", w: 142, h: 118, x: 1198, y: 62, cardW: 220, cardH: 170 },
      { name: "barrel.png", w: 76, h: 98, x: 1434, y: 62, cardW: 220, cardH: 170 }
    ]}
  ]
};

const SCANNER = {
  pageName: "Scanner Pack v1 - Imported",
  boardName: "Bourbon Hunters / Scanner Asset Pack v1",
  subtitle: "Bottle scanner feature / real PNG assets imported from GitHub Pages",
  folder: "scanner-pack-v1",
  board: { w: 1780, h: 2500 },
  sections: [
    { title: "0. Original Source Board", x: 44, y: 244, w: 820, h: 700, assets: [
      { name: "source-board-preview.jpg", w: 1216, h: 1294, x: 18, y: 58, cardW: 784, cardH: 610 }
    ]},
    { title: "1. Screen + Preview", x: 900, y: 244, w: 820, h: 700, assets: [
      { name: "scanner-screen-preview.png", w: 380, h: 778, x: 18, y: 62, cardW: 330, cardH: 590 },
      { name: "scan-screen-bg.png", w: 268, h: 457, x: 372, y: 62, cardW: 210, cardH: 310 },
      { name: "analyzing-overlay.png", w: 260, h: 187, x: 604, y: 62, cardW: 190, cardH: 170 },
      { name: "result-card-bg.png", w: 430, h: 158, x: 372, y: 398, cardW: 422, cardH: 170 }
    ]},
    { title: "2. Scanner Frame", x: 44, y: 984, w: 820, h: 620, assets: [
      { name: "scan-frame.png", w: 300, h: 390, x: 18, y: 62, cardW: 330, cardH: 500 },
      { name: "scan-corner-top-left.png", w: 153, h: 80, x: 372, y: 62, cardW: 190, cardH: 130 },
      { name: "scan-corner-top-right.png", w: 153, h: 80, x: 584, y: 62, cardW: 190, cardH: 130 },
      { name: "scan-corner-bottom-left.png", w: 153, h: 80, x: 372, y: 222, cardW: 190, cardH: 130 },
      { name: "scan-corner-bottom-right.png", w: 153, h: 80, x: 584, y: 222, cardW: 190, cardH: 130 },
      { name: "scan-beam.png", w: 340, h: 40, x: 372, y: 382, cardW: 402, cardH: 120 }
    ]},
    { title: "3. Controls", x: 900, y: 984, w: 820, h: 360, assets: [
      { name: "scan-button.png", w: 132, h: 132, x: 18, y: 62, cardW: 190, cardH: 210 },
      { name: "retake-button.png", w: 85, h: 86, x: 230, y: 62, cardW: 170, cardH: 210 },
      { name: "gallery-button.png", w: 85, h: 86, x: 422, y: 62, cardW: 170, cardH: 210 },
      { name: "ai-analysis-button.png", w: 266, h: 72, x: 614, y: 62, cardW: 180, cardH: 210 }
    ]},
    { title: "4. Badges + States", x: 900, y: 1384, w: 820, h: 360, assets: [
      { name: "bottle-detected-badge.png", w: 206, h: 43, x: 18, y: 62, cardW: 230, cardH: 130 },
      { name: "confidence-badge.png", w: 210, h: 44, x: 270, y: 62, cardW: 230, cardH: 130 },
      { name: "rating-chip-empty.png", w: 72, h: 73, x: 522, y: 62, cardW: 130, cardH: 130 },
      { name: "rating-chip-filled.png", w: 72, h: 73, x: 674, y: 62, cardW: 130, cardH: 130 },
      { name: "hunter-loading-mark.png", w: 101, h: 104, x: 18, y: 214, cardW: 180, cardH: 120 },
      { name: "error-state-icon.png", w: 136, h: 136, x: 220, y: 214, cardW: 180, cardH: 120 }
    ]},
    { title: "5. Reference Blocks", x: 44, y: 1644, w: 1676, h: 360, assets: [
      { name: "scanner-color-palette.png", w: 365, h: 122, x: 18, y: 62, cardW: 390, cardH: 170 },
      { name: "scanner-typography.png", w: 257, h: 122, x: 430, y: 62, cardW: 310, cardH: 170 },
      { name: "scanner-icon-style.png", w: 309, h: 122, x: 762, y: 62, cardW: 350, cardH: 170 },
      { name: "scanner-notes.png", w: 249, h: 122, x: 1134, y: 62, cardW: 300, cardH: 170 }
    ]}
  ]
};

const REFERENCE = {
  pageName: "Bourbon Hunters Asset Packs",
  boardName: "Bourbon Hunters / Background + Explore References",
  subtitle: "New visual references / app background and Explore screen source images",
  folder: "reference-pack-v1",
  board: { w: 1780, h: 1120 },
  sections: [
    { title: "1. Application Background", x: 44, y: 244, w: 820, h: 800, assets: [
      { name: "app-background.png", w: 1024, h: 1536, x: 18, y: 58, cardW: 784, cardH: 700 }
    ]},
    { title: "2. Explore Screen", x: 900, y: 244, w: 820, h: 800, assets: [
      { name: "explore-screen.png", w: 1024, h: 1536, x: 18, y: 58, cardW: 784, cardH: 700 }
    ]}
  ]
};

const HOME_V2 = {
  pageName: "Bourbon Hunters Asset Packs",
  boardName: "Bourbon Hunters / Home Runtime Pack v2",
  subtitle: "Optimized runtime assets used by the current home screen",
  folder: "home-pack-v2",
  board: { w: 1780, h: 980 },
  sections: [
    { title: "1. Home Header + App Background", x: 44, y: 244, w: 1676, h: 360, assets: [
      { name: "home-header.jpg", w: 1000, h: 574, x: 18, y: 58, cardW: 620, cardH: 250 },
      { name: "app-background.jpg", w: 900, h: 1350, x: 680, y: 58, cardW: 320, cardH: 250 }
    ]},
    { title: "2. Category Icons", x: 44, y: 644, w: 1676, h: 260, assets: [
      { name: "small-batch.png", w: 256, h: 256, x: 18, y: 58, cardW: 220, cardH: 160 },
      { name: "single-barrel.png", w: 256, h: 256, x: 258, y: 58, cardW: 220, cardH: 160 },
      { name: "bottled-in-bond.png", w: 256, h: 256, x: 498, y: 58, cardW: 220, cardH: 160 },
      { name: "barrel-proof.png", w: 256, h: 256, x: 738, y: 58, cardW: 220, cardH: 160 },
      { name: "rye-whiskey.png", w: 256, h: 256, x: 978, y: 58, cardW: 220, cardH: 160 },
      { name: "limited-edition.png", w: 256, h: 256, x: 1218, y: 58, cardW: 220, cardH: 160 }
    ]}
  ]
};

function paint(color, opacity = 1) {
  return [{ type: "SOLID", color, opacity }];
}

async function loadFonts() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
}

async function addText(parent, name, characters, x, y, size, color = COLORS.text, style = "Regular") {
  const node = figma.createText();
  node.name = name;
  node.x = x;
  node.y = y;
  node.fontName = { family: "Inter", style };
  node.fontSize = size;
  node.characters = characters;
  node.fills = paint(color);
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  parent.appendChild(node);
  return node;
}

function addFrame(parent, name, x, y, width, height, fill = COLORS.panel, radius = 14) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.cornerRadius = radius;
  frame.fills = paint(fill);
  frame.strokes = paint(COLORS.line, 0.85);
  frame.strokeWeight = 1;
  frame.clipsContent = false;
  parent.appendChild(frame);
  return frame;
}

async function imageFillFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot fetch ${url}: ${response.status}`);
  }
  const image = figma.createImage(new Uint8Array(await response.arrayBuffer()));
  return { type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" };
}

async function addAsset(parent, pack, asset) {
  const card = addFrame(parent, `Asset / ${asset.name}`, asset.x, asset.y, asset.cardW, asset.cardH, COLORS.panel, 12);
  const imageAreaHeight = Math.max(40, asset.cardH - 56);
  const imageNode = figma.createRectangle();
  imageNode.name = asset.name;
  imageNode.x = 14;
  imageNode.y = 14;
  imageNode.resize(asset.cardW - 28, imageAreaHeight - 14);
  imageNode.cornerRadius = 8;
  imageNode.fills = [await imageFillFromUrl(`${ROOT_URL}${pack.folder}/${asset.name}`)];
  imageNode.strokes = paint(COLORS.copper, 0.55);
  imageNode.strokeWeight = 1;
  card.appendChild(imageNode);
  await addText(card, `Name / ${asset.name}`, asset.name, 14, asset.cardH - 38, 12, COLORS.text, "Semi Bold");
  await addText(card, `Size / ${asset.name}`, `${asset.w}x${asset.h} px`, 14, asset.cardH - 20, 10, COLORS.muted, "Regular");
}

async function addSection(parent, title, x, y, width, height) {
  const section = addFrame(parent, `Section / ${title}`, x, y, width, height, COLORS.panel2, 18);
  await addText(section, `Title / ${title}`, title, 18, 16, 18, COLORS.copper, "Bold");
  return section;
}

async function addSwatch(parent, hex, x, y) {
  const color = {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255
  };
  addFrame(parent, `Color / ${hex}`, x, y, 44, 44, color, 8);
  await addText(parent, `Label / ${hex}`, hex, x + 56, y + 13, 13, COLORS.muted, "Regular");
}

async function buildPack(page, pack, x, y) {
  const board = addFrame(page, pack.boardName, x, y, pack.board.w, pack.board.h, COLORS.bg, 22);
  await addText(board, "Title", "BOURBON HUNTERS", 44, 34, 48, COLORS.copper, "Bold");
  await addText(board, "Subtitle", pack.subtitle, 44, 92, 18, COLORS.text, "Regular");
  await addText(board, "Source", `${ROOT_URL}${pack.folder}/`, 44, 124, 13, COLORS.muted, "Regular");

  const palette = ["#111111", "#1D1B18", "#B86A33", "#E2B070", "#2E5A4F", "#F6F1EA"];
  for (let i = 0; i < palette.length; i += 1) {
    await addSwatch(board, palette[i], 44 + i * 145, 168);
  }

  for (const sectionDef of pack.sections) {
    const section = await addSection(board, sectionDef.title, sectionDef.x, sectionDef.y, sectionDef.w, sectionDef.h);
    for (const asset of sectionDef.assets) {
      await addAsset(section, pack, asset);
    }
  }
  return board;
}

async function build() {
  await loadFonts();
  const pageName = "Bourbon Hunters Asset Packs";
  let page = figma.root.children.find((p) => p.name === pageName);
  if (!page) {
    page = figma.currentPage;
    page.name = pageName;
  }
  await figma.setCurrentPageAsync(page);
  for (const child of [...page.children]) child.remove();

  const homeBoard = await buildPack(page, HOME, 80, 80);
  const scannerBoard = await buildPack(page, SCANNER, 1940, 80);
  const referenceBoard = await buildPack(page, REFERENCE, 80, 2720);
  const homeV2Board = await buildPack(page, HOME_V2, 1940, 2720);
  figma.viewport.scrollAndZoomIntoView([homeBoard, scannerBoard, referenceBoard, homeV2Board]);
  figma.notify("Bourbon Hunters asset packs imported into one page.");
  figma.closePlugin();
}

build().catch((error) => {
  figma.notify(`Import failed: ${error.message}`);
  figma.closePlugin();
});
