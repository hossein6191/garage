// Barlow Condensed and Kalam for the share card, fetched from Google Fonts when the card is built and
// cut down to the characters it prints. If the fetch fails the card is still built, in the renderer's
// own font.

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" };

async function load(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!resource) throw new Error("no font in the stylesheet");
  const res = await fetch(resource[1]);
  if (res.status !== 200) throw new Error("font fetch failed");
  return res.arrayBuffer();
}

export async function cardFonts(head: string, hand: string): Promise<Font[]> {
  try {
    const [a, b] = await Promise.all([load("Barlow Condensed", 800, head), load("Kalam", 400, hand)]);
    return [
      { name: "Barlow Condensed", data: a, weight: 800, style: "normal" },
      { name: "Kalam", data: b, weight: 400, style: "normal" },
    ];
  } catch {
    return [];
  }
}
