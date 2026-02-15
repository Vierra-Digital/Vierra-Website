export type Area = { x: number; y: number; width: number; height: number };

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize = 256
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    if (!url.startsWith("data:")) {
      image.setAttribute("crossOrigin", "anonymous");
    }
    image.src = url;
  });
}
