export const OPENINGS = {
  "e4": "King's Pawn Game",
  "d4": "Queen's Pawn Game",
  "c4": "English Opening",
  "Nf3": "Réti Opening",
  "e4 e5": "Open Game",
  "e4 c5": "Sicilian Defense",
  "e4 e6": "French Defense",
  "e4 c6": "Caro-Kann Defense",
  "e4 d6": "Pirc Defense",
  "e4 d5": "Scandinavian Defense",
  "e4 Nf6": "Alekhine's Defense",
  "e4 g6": "Modern Defense",
  "d4 d5": "Closed Game",
  "d4 Nf6": "Indian Defense",
  "d4 Nf6 c4": "Indian Defense",
  "d4 Nf6 c4 e6": "Indian Defense",
  "d4 Nf6 c4 e6 Nf3": "Indian Defense",
  "d4 Nf6 c4 g6": "King's Indian / Grünfeld",
  "d4 f5": "Dutch Defense",
  "d4 d5 c4": "Queen's Gambit",
  "d4 d5 c4 e6": "Queen's Gambit Declined",
  "d4 d5 c4 c6": "Slav Defense",
  "d4 d5 c4 dxc4": "Queen's Gambit Accepted",
  "e4 e5 Nf3": "King's Knight Opening",
  "e4 e5 Nf3 Nc6": "King's Knight Opening",
  "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez",
  "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
  "e4 e5 Nf3 Nc6 Bc4 Bc5": "Giuoco Piano",
  "e4 e5 Nf3 Nc6 Bc4 Nf6": "Two Knights Defense",
  "e4 e5 Nf3 Nc6 d4": "Scotch Game",
  "e4 e5 f4": "King's Gambit",
  "e4 e5 Nf3 Nf6": "Petrov's Defense",
  "e4 c5 Nf3 d6 d4": "Sicilian, Open",
  "e4 c5 Nf3 Nc6 d4": "Sicilian, Open",
  "e4 c5 Nf3 e6 d4": "Sicilian, Open",
  "d4 Nf6 c4 e6 Nc3 Bb4": "Nimzo-Indian Defense",
  "d4 Nf6 c4 e6 Nf3 b6": "Queen's Indian Defense",
  "d4 Nf6 c4 c5": "Benoni Defense",
  "d4 Nf6 c4 c5 d5 b5": "Benko Gambit"
};

export function getOpeningName(history) {
  let longestMatch = "";
  let sanSequence = "";
  
  // Try up to first 6 half-moves (3 full moves)
  const maxDepth = Math.min(6, history.length);
  for (let i = 0; i < maxDepth; i++) {
    sanSequence += (i > 0 ? " " : "") + history[i].san;
    if (OPENINGS[sanSequence]) {
      longestMatch = OPENINGS[sanSequence];
    }
  }
  
  return longestMatch;
}
