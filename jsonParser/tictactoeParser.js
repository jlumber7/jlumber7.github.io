document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById("fileInput");
  const processButton = document.getElementById("processButton");
  const outputBox = document.getElementById("outputBox");

  let groupedBoardStates = [];
  let boardStateDict = {};
  let playthroughDict = {};
  const FAILED_FILE_KEY = "failed_playthroughs";

  // Game state variables
  let playthrough = Array(9).fill(null);
  let currentMoveNum = 0;
  let currentItem = {};
  let currentBoardState = "";
  let lastPlaythroughUUID = null;
  let currentSeed = null;

  function logOutput(message) {
    outputBox.textContent += message + '\n';
    outputBox.scrollTop = outputBox.scrollHeight;
  }

  function clearOutput() {
    outputBox.textContent = '';
  }

  function createDicts() {
    boardStateDict = {};
    playthroughDict = {};

    groupedBoardStates.forEach((item) => {
      boardStateDict[item.board_state_uuid] = item;

      (item.playthroughs || []).forEach((uuid) => {
        if (!playthroughDict[uuid]) {
          playthroughDict[uuid] = Array(9).fill(null);
        }
        playthroughDict[uuid][item.move_num - 1] = item.board_state_uuid;
      });
    });
  }

  function loadFailedPlaythroughs() {
    const data = localStorage.getItem(FAILED_FILE_KEY);
    return data ? JSON.parse(data) : {};
  }

  function saveFailedPlaythrough() {
    const failedPlaythroughs = loadFailedPlaythroughs();

    if (!failedPlaythroughs.hasOwnProperty(currentSeed.toString())) {
      failedPlaythroughs[currentSeed.toString()] = playthrough;
      localStorage.setItem(FAILED_FILE_KEY, JSON.stringify(failedPlaythroughs));
    } else {
      logOutput(`Seed ${currentSeed}: Failure already recorded, skipping save.`);
    }
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function getRandomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function startingBoardState() {
    let startingBoard = Array(8).fill(" ").concat(["X"]);
    shuffle(startingBoard);
    startingBoard = startingBoard.join("");

    const startingBoardUUID = generateUUID5(startingBoard);
    playthrough[0] = startingBoardUUID;

    if (boardStateDict[startingBoardUUID]) {
      currentItem = JSON.parse(JSON.stringify(boardStateDict[startingBoardUUID]));
    }
  }

  function getPlaythrough(uuid) {
    return playthroughDict[uuid] || Array(9).fill(null);
  }

  function checkIfWinner(uuid) {
    return boardStateDict[uuid]?.game_over || false;
  }

  function getNextItem(uuid) {
    return JSON.parse(JSON.stringify(boardStateDict[uuid] || {}));
  }

  function nextSection() {
    if (!currentItem.playthroughs || currentItem.playthroughs.length === 0) {
      logOutput("No playthroughs found for current state.");
      return false;
    }

    const availablePlaythroughs = currentItem.playthroughs.filter(
      (uuid) => uuid !== lastPlaythroughUUID
    );

    if (availablePlaythroughs.length === 0) {
      logOutput(`Seed ${currentSeed}: No valid new playthroughs available. Saving failed playthrough.`);
      saveFailedPlaythrough();
      return false;
    }

    const nextPlaythroughUUID = getRandomChoice(availablePlaythroughs);
    lastPlaythroughUUID = nextPlaythroughUUID;

    const nextPlaythrough = getPlaythrough(nextPlaythroughUUID);
    const numFrames = Math.floor(Math.random() * 3) + 1;

    for (let num = 0; num < numFrames; num++) {
      const index = currentMoveNum + num + 1;
      if (index >= 9) break;

      playthrough[index] = nextPlaythrough[index];

      if (checkIfWinner(playthrough[index])) {
        logOutput("win");
        return true;
      }
    }

    currentMoveNum += numFrames;
    currentBoardState = playthrough[currentMoveNum];
    currentItem = getNextItem(currentBoardState);

    return false;
  }

  function fullParse() {
    startingBoardState();
    for (let i = 0; i < 10; i++) {
      if (nextSection()) break;
    }
  }

  function runSimulation() {
    clearOutput();
    for (let num = 0; num < 100; num++) {
      if (typeof Math.seedrandom === "function") {
        Math.seedrandom(num);
      }

      currentSeed = num;
      fullParse();
      logOutput(playthrough.join(', '));

      // Reset
      playthrough = Array(9).fill(null);
      currentMoveNum = 0;
      currentItem = {};
      currentBoardState = "";
      lastPlaythroughUUID = null;
    }
  }

  processButton.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        groupedBoardStates = JSON.parse(event.target.result);
        createDicts();
        runSimulation();
      } catch (err) {
        logOutput("Failed to parse JSON: " + err);
      }
    };

    reader.readAsText(file);
  });
});

