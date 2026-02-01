export function rgbStringToHSL(rgbStr) {
    // Extract numbers
    const [r, g, b] = rgbStr.match(/\d+/g).map(Number);

    // Normalize to 0-1
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;

    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // Achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rN:
                h = (gN - bN) / d + (gN < bN ? 6 : 0);
                break;
            case gN:
                h = (bN - rN) / d + 2;
                break;
            case bN:
                h = (rN - gN) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}
