import { useEffect, useRef, useState } from "react";
import { mapProgressFor, resultFor } from "./engine.ts";
import type { SaveState } from "./engine.ts";
import type { SiteConfig } from "./config.ts";
import { track } from "./config.ts";
import { canvasToBlob, copyText, drawResultCard } from "./share.ts";

type Props = { config: SiteConfig; state: SaveState; onNotice: (text: string) => void };

// The end-of-campaign card and three ways to send it. A win's link carries only the campaign day.
export default function ResultPanel({ config, state, onNotice }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const result = resultFor(state);
  const won = result.outcome === "won";
  const link = won ? `${config.siteUrl}/?day=${result.day}` : `${config.siteUrl}/`;
  const text = won
    ? `I won the 2028 race on campaign day ${result.day} of 730 in PRES2028: Citizen, a free fictional campaign game (no party, no candidate). Can you clinch 270 sooner?`
    : `Time ran out on my 2028 race at ${result.electoralVotes} electoral votes in PRES2028: Citizen, a free fictional campaign game. Can you reach 270?`;
  const organizedFips = mapProgressFor(state.organizers).organized.map((entry) => entry.fips).join(",");

  useEffect(() => {
    if (!canvasRef.current) return;
    setDrawn(
      drawResultCard(canvasRef.current, {
        won,
        day: result.day,
        daysLeft: result.daysLeft,
        electoralVotes: result.electoralVotes,
        statesOrganized: result.statesOrganized,
        mandates: result.mandates,
        moves: result.moves,
        organizedFips: organizedFips ? organizedFips.split(",") : [],
        siteLabel: config.siteUrl.replace(/^https?:\/\//, ""),
      }),
    );
  }, [won, result.day, result.daysLeft, result.electoralVotes, result.statesOrganized, result.mandates, result.moves, organizedFips, config.siteUrl]);

  async function share() {
    const blob = canvasRef.current ? await canvasToBlob(canvasRef.current) : null;
    try {
      if (blob && typeof File === "function" && navigator.canShare) {
        const file = new File([blob], "pres2028-citizen.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `${text} ${link}` });
          track("share_native");
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: "PRES2028: Citizen", text, url: link });
        track("share_native");
        return;
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
    }
    await copyLink();
  }

  async function download() {
    const blob = canvasRef.current ? await canvasToBlob(canvasRef.current) : null;
    if (!blob) {
      onNotice("This browser could not make the image. Take a screenshot of the card instead.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = won ? `pres2028-won-day-${result.day}.png` : `pres2028-${result.electoralVotes}-ev.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    track("share_download");
  }

  async function copyLink() {
    const copied = await copyText(`${text} ${link}`);
    track("share_copy");
    onNotice(copied ? "LINK COPIED — whoever opens it sees the day to beat." : `Copy this link: ${link}`);
  }

  return (
    <div className="result-panel" data-testid="result-panel">
      <canvas
        ref={canvasRef}
        className="result-card"
        width={1200}
        height={630}
        role="img"
        aria-label={won ? `Result card: won the 2028 race on campaign day ${result.day}` : `Result card: ${result.electoralVotes} electoral votes`}
        data-testid="result-card"
        data-drawn={drawn ? "yes" : "no"}
      />
      <div className="share-row">
        <button type="button" onClick={share} data-testid="share-native">SHARE</button>
        <button type="button" onClick={download} disabled={!drawn} data-testid="share-download">SAVE CARD</button>
        <button type="button" onClick={copyLink} data-testid="share-copy">COPY LINK</button>
      </div>
      <a className="share-link" href={link} data-testid="share-link">{link.replace(/^https?:\/\//, "")}</a>
    </div>
  );
}
