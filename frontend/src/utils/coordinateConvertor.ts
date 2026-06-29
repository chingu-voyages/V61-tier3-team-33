const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function coordToSquare(coord: [number, number]) {

    const [x, y] = coord;

    return files[x] + (8 - y);

}