// The end-of-campaign result card: a 1200x630 image drawn on the player's device. Nothing is uploaded.
import { MAP } from "./UsaMap.tsx";

export type CardData = {
  won: boolean;
  day: number;
  daysLeft: number;
  electoralVotes: number;
  statesOrganized: number;
  mandates: number;
  moves: number;
  organizedFips: string[];
  siteLabel: string;
};

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const INK = "#17152b";
const CREAM = "#f4ecda";
const PAPER = "#fff9ea";
const PURPLE = "#65449b";
const GOLD = "#e7b34c";
const GOLD_LIGHT = "#ffe4a0";
const RED = "#d6564d";
const MONO = '{weight} {size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

function mono(size: number, weight = 900) {
  return MONO.replace("{size}", String(size)).replace("{weight}", String(weight));
}

function fit(context: CanvasRenderingContext2D, text: string, size: number, maxWidth: number, weight = 900) {
  let current = size;
  context.font = mono(current, weight);
  while (context.measureText(text).width > maxWidth && current > 12) {
    current -= 2;
    context.font = mono(current, weight);
  }
  return current;
}

export function drawResultCard(canvas: HTMLCanvasElement, data: CardData) {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return false;

  context.fillStyle = CREAM;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.strokeStyle = "rgba(23, 21, 43, 0.05)";
  context.lineWidth = 1;
  for (let x = 0; x < CARD_WIDTH; x += 18) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, CARD_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y < CARD_HEIGHT; y += 18) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(CARD_WIDTH, y + 0.5);
    context.stroke();
  }

  // Map panel on the right.
  const panel = { x: 640, y: 40, width: 520, height: 470 };
  context.fillStyle = INK;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);
  context.fillStyle = data.won ? GOLD : RED;
  context.fillRect(panel.x + 10, panel.y + panel.height, panel.width, 10);
  context.fillRect(panel.x + panel.width, panel.y + 10, 10, panel.height);
  const scale = (panel.width - 40) / MAP.width;
  context.save();
  context.translate(panel.x + 20, panel.y + 70);
  context.scale(scale, scale);
  const organized = new Set(data.organizedFips);
  for (const shape of MAP.states) {
    const lit = organized.has(shape.fips);
    context.fillStyle = lit ? GOLD : "#353049";
    context.strokeStyle = lit ? "#fff0bd" : "#655e7b";
    context.lineWidth = 1 / scale;
    if (shape.d && typeof Path2D === "function") {
      const path = new Path2D(shape.d);
      context.fill(path);
      context.stroke(path);
    } else {
      context.fillRect(shape.cx - 3, shape.cy - 3, 6, 6);
    }
  }
  context.restore();
  context.fillStyle = GOLD;
  context.font = mono(15);
  context.fillText("2028 ELECTORAL MAP", panel.x + 22, panel.y + 36);
  context.fillStyle = GOLD_LIGHT;
  context.textAlign = "right";
  context.font = mono(34);
  context.fillText(`${data.electoralVotes}`, panel.x + panel.width - 92, panel.y + 42);
  context.font = mono(14);
  context.fillStyle = "#aaa2b9";
  context.fillText("/270 EV", panel.x + panel.width - 22, panel.y + 42);
  context.textAlign = "left";

  // The claim on the left.
  context.fillStyle = INK;
  context.font = mono(26, 950);
  context.fillText("PRES", 48, 78);
  const presWidth = context.measureText("PRES").width;
  context.fillStyle = PURPLE;
  context.fillText("2028", 48 + presWidth, 78);
  context.fillStyle = INK;
  context.font = mono(14);
  context.fillText("/ CITIZEN", 48 + presWidth + context.measureText("2028 ").width + 30, 78);

  context.fillStyle = PURPLE;
  context.font = mono(20);
  context.fillText(data.won ? "I WON THE 2028 RACE ON" : "TIME RAN OUT ON MY 2028 RACE", 48, 168);
  context.fillStyle = data.won ? INK : RED;
  const headline = data.won ? `DAY ${data.day}` : `${data.electoralVotes} EV`;
  const size = fit(context, headline, 150, 560, 950);
  context.fillText(headline, 42, 168 + 20 + size * 0.8);
  context.fillStyle = "#4f494a";
  context.font = mono(20, 800);
  context.fillText(data.won ? `OF 730 · ${data.daysLeft} DAYS TO SPARE` : `${270 - data.electoralVotes} SHORT OF 270`, 48, 400);

  context.fillStyle = INK;
  context.fillRect(48, 432, 548, 3);
  const stats = `${data.statesOrganized}/51 ORGANIZED · ${data.mandates}/8 MANDATES · ${data.moves} MOVES`;
  fit(context, stats, 19, 548, 900);
  context.fillText(stats, 48, 468);

  context.fillStyle = PURPLE;
  context.font = mono(17);
  context.fillText(data.won ? "CAN YOU WIN SOONER?" : "CAN YOU REACH 270?", 48, 530);
  context.fillStyle = INK;
  fit(context, data.siteLabel, 17, 548, 900);
  context.fillText(data.siteLabel, 48, 556);
  context.fillStyle = "#7b746f";
  context.font = mono(13, 800);
  context.fillText("A FICTIONAL CAMPAIGN GAME · NO REAL PARTY OR CANDIDATE", 48, 596);
  context.fillStyle = PAPER;
  return true;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers or contexts without the async clipboard API.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const done = document.execCommand("copy");
      area.remove();
      return done;
    } catch {
      return false;
    }
  }
}
