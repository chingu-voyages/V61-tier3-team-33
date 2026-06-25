export class FENError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FENError";
  }
}

export class IllegalMoveError extends Error {
  constructor() {
    super("illegal move");
    this.name = "IllegalMoveError";
  }
}

export class InvalidSquareError extends Error {
  constructor(square: string) {
    super(`invalid square: ${square}`);
    this.name = "InvalidSquareError";
  }
}

export class NothingToUndoError extends Error {
  constructor() {
    super("nothing to undo");
    this.name = "NothingToUndoError";
  }
}
