const { Jimp } = require("jimp");

async function createSplash() {
  try {
    console.log("Reading input image...");
    const logo = await Jimp.read("assets/splash.png");
    
    // Scale logo to a much larger size (1400x1400)
    logo.scaleToFit({ w: 1400, h: 1400 });

    console.log("Creating 2732x2732 white background...");
    const background = new Jimp({ width: 2732, height: 2732, color: 0xFFFFFFFF });

    console.log("Compositing...");
    const x = (2732 - logo.bitmap.width) / 2;
    const y = (2732 - logo.bitmap.height) / 2;
    background.composite(logo, x, y);

    console.log("Saving...");
    await background.write("assets/splash-fixed.png");
    console.log("Done!");
  } catch (err) {
    console.error(err);
  }
}

createSplash();
