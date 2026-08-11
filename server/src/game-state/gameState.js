class GameState {
  constructor() {
    this.games = new Map();
  }

  setGame(gameId, data) {
    this.games.set(gameId, data);
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  deleteGame(gameId) {
    this.games.delete(gameId);
  }
}

module.exports = new GameState();
