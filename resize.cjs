const { Jimp } = require("jimp");

async function createSplash() {
  try {
    console.log("Reading input image...");
    const logo = await Jimp.read("assets/splash-original.png");
    
    // Scale logo to a much larger size (1800x1800) so it looks good on iPad and iPhone
    logo.scaleToFit({ w: 1800, h: 1800 });

    console.log("Creating 2732x2732 white background...");
    const background = new Jimp({ width: 2732, height: 2732, color: 0xFFFFFFFF });

    console.log("Compositing...");
    const x = (2732 - logo.bitmap.width) / 2;
    const y = (2732 - logo.bitmap.height) / 2;
    background.composite(logo, x, y);

    console.log("Saving...");
    await background.write("assets/splash.png");
    await background.write("assets/splash-dark.png");
    console.log("Done!");
  } catch (err) {
    console.error(err);
  }
}

createSplash();
