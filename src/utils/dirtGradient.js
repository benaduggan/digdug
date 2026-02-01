export const DIRT_COLORS = [
    {
        DIRT_TOP: 'rgb(244, 187, 64)',
        DIRT_MID: 'rgb(207, 111, 41)',
        DIRT_LOW: 'rgb(169, 49, 24)',
        DIRT_LOWEST: 'rgb(138, 26, 16)',
    },
    {
        DIRT_TOP: 'rgb(128, 128, 128)',
        DIRT_MID: 'rgb(162, 130, 74)',
        DIRT_LOW: 'rgb(222, 171, 58)',
        DIRT_LOWEST: 'rgb(187, 102, 37)',
    },
    {
        DIRT_TOP: 'rgb(128, 128, 128)',
        DIRT_MID: 'rgb(104, 104, 69)',
        DIRT_LOW: 'rgb(73, 103, 68)',
        DIRT_LOWEST: 'rgb(64, 64, 64)',
    },
];

function rgbStringToHSL(rgbStr) {
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

export function getDirtGradient(level) {
    const groupIndex = Math.floor((level - 1) / 5);
    const finalIndex = groupIndex % DIRT_COLORS.length;
    const { DIRT_TOP, DIRT_MID, DIRT_LOW, DIRT_LOWEST } =
        DIRT_COLORS[finalIndex];

    return [
        { stop: 0.0, color: rgbStringToHSL(DIRT_TOP) },
        { stop: 0.33, color: rgbStringToHSL(DIRT_MID) },
        { stop: 0.66, color: rgbStringToHSL(DIRT_LOW) },
        { stop: 1.0, color: rgbStringToHSL(DIRT_LOWEST) },
    ];
}
