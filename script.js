const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const playButton = document.getElementById("playButton");

const gameArea = document.getElementById("gameArea");
const dino = document.getElementById("dino");
const dinoImage = document.getElementById("dinoImage");
const obstaclesContainer = document.getElementById("obstacles");
const ground = document.getElementById("ground");
const startMessage = document.getElementById("startMessage");

const currentScoreEl = document.getElementById("currentScore");
const bestScoreEl = document.getElementById("bestScore");
const menuBestScoreEl = document.getElementById("menuBestScore");
const historyList = document.getElementById("historyList");

const endModal = document.getElementById("endModal");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");
const restartButton = document.getElementById("restartButton");
const backMenuButton = document.getElementById("backMenuButton");

const skinButtons = document.querySelectorAll(".skin-card");

const adminButton = document.getElementById("adminButton");
const adminPanel = document.getElementById("adminPanel");
const adminCodeInput = document.getElementById("adminCodeInput");
const adminEnterButton = document.getElementById("adminEnterButton");
const adminStatus = document.getElementById("adminStatus");
const adminControls = document.getElementById("adminControls");
const adminStartScoreInput = document.getElementById("adminStartScore");

const STORAGE_RECORD = "pixel_runner_record";
const STORAGE_HISTORY = "pixel_runner_history";

const ADMIN_CODE = "MCM2C";

const GROUND_HEIGHT = 28;

let adminUnlocked = false;
let sessionBestScore = 0;
let selectedSkin = "default";

// Configuração das skins
const skins = {
  default: {
    name: "Tiranossauro",
    req: 0,
    frames: ["assets/dino-default-1.png", "assets/dino-default-2.png"]
  },
  skin1: {
    name: "Raptor",
    req: 10000,
    frames: ["assets/dino-skin1-1.png", "assets/dino-skin1-2.png"]
  },
  skin2: {
    name: "Carnotauro",
    req: 20000,
    frames: ["assets/dino-skin2-1.png", "assets/dino-skin2-2.png"]
  },
  skin3: {
    name: "Pterossauro",
    req: 30000,
    frames: ["assets/dino-skin3-1.png", "assets/dino-skin3-2.png"]
  }
};

const obstacleTypes = [
  {
    name: "small",
    width: 64,
    height: 64,
    image: "assets/obstacle-small.png",
    collisionBox: { x: 8, y: 34, width: 50, height: 24 }
  },
  {
    name: "medium",
    width: 72,
    height: 72,
    image: "assets/obstacle-medium.png",
    collisionBox: { x: 6, y: 32, width: 62, height: 30 }
  },
  {
    name: "large",
    width: 96,
    height: 96,
    image: "assets/obstacle-large.png",
    collisionBox: { x: 36, y: 42, width: 30, height: 48 }
  }
];

let game = {
  running: false,
  won: false,
  score: 0,
  speed: 350,
  elapsedTime: 0,
  y: 0,
  velocityY: 0,
  gravity: 0.95,
  jumpForce: 16.5,
  onGround: true,
  obstacles: [],
  distanceUntilNextObstacle: 0,
  obstaclePauseUntil: 0,
  lastTime: 0,
  rafId: null,
  groundOffset: 0,
  bgOffset: 0,
  currentFrame: 0,
  lastFrameChange: 0,
  currentPhase: 0
};

function getRecord() {
  return Number(localStorage.getItem(STORAGE_RECORD)) || 0;
}

function setRecord(value) {
  localStorage.setItem(STORAGE_RECORD, String(value));
}

// Histórico usando sessionStorage.
// Isso faz o histórico resetar quando a aba/página for fechada.
function getHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_HISTORY)) || [];
  } catch {
    return [];
  }
}

function setHistory(history) {
  sessionStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
}

function saveRound(score) {
  const finalScore = Math.floor(score);
  const record = getRecord();

  if (finalScore > record) {
    setRecord(finalScore);
  }

  if (finalScore > sessionBestScore) {
    sessionBestScore = finalScore;
  }

  const history = getHistory();
  history.unshift(finalScore);
  setHistory(history);
}

function canUseSkin(skinId) {
  const skin = skins[skinId];

  if (!skin) return false;

  return adminUnlocked || sessionBestScore >= skin.req;
}

function ensureSelectedSkinIsAllowed() {
  if (!canUseSkin(selectedSkin)) {
    selectedSkin = "default";
  }
}

function updateMenuStats() {
  ensureSelectedSkinIsAllowed();

  const record = getRecord();
  menuBestScoreEl.textContent = record;
  historyList.innerHTML = "";

  const history = getHistory();

  if (history.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma rodada ainda";
    historyList.appendChild(li);
  } else {
    history.forEach((score) => {
      const li = document.createElement("li");
      li.textContent = `${score} pontos`;
      historyList.appendChild(li);
    });
  }

  document.querySelectorAll(".skin-card").forEach((button) => {
    const skinId = button.dataset.skin;
    const req = skins[skinId].req;
    const lockedEl = button.querySelector(".lock-tag");

    if (adminUnlocked || sessionBestScore >= req) {
      button.classList.remove("locked");

      if (lockedEl) {
        lockedEl.style.display = "none";
      }
    } else {
      button.classList.add("locked");

      if (lockedEl) {
        lockedEl.style.display = "block";
        lockedEl.textContent = `${req / 1000}k pts`;
      }
    }
  });

  updateSkinSelection();
}

function updateSkinSelection() {
  skinButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.skin === selectedSkin);
  });
}

function selectSkin(skinId) {
  if (!canUseSkin(skinId)) return;

  selectedSkin = skinId;
  updateSkinSelection();
  setDinoFrame(0);
}

function setDinoFrame(frameIndex) {
  const skin = skins[selectedSkin] || skins.default;
  dinoImage.src = skin.frames[frameIndex];
}

function getAdminStartScore() {
  if (!adminUnlocked) return 0;

  const value = Number(adminStartScoreInput.value);

  if (!Number.isFinite(value) || value < 0) {
    adminStartScoreInput.value = 0;
    return 0;
  }

  return Math.floor(value);
}

function applyPhaseByScore(score) {
  gameArea.classList.remove("phase-1", "phase-2", "phase-3", "phase-flash");

  if (score >= 30000) {
    gameArea.classList.add("phase-3");
    game.currentPhase = 3;
  } else if (score >= 20000) {
    gameArea.classList.add("phase-2");
    game.currentPhase = 2;
  } else if (score >= 10000) {
    gameArea.classList.add("phase-1");
    game.currentPhase = 1;
  } else {
    game.currentPhase = 0;
  }
}

function activateAdminMode() {
  const code = adminCodeInput.value.trim().toUpperCase();

  if (code !== ADMIN_CODE) {
    adminStatus.textContent = "Código incorreto.";
    adminStatus.style.color = "#9b1c1c";
    return;
  }

  adminUnlocked = true;

  adminButton.classList.add("active");
  adminControls.classList.add("active");
  adminCodeInput.value = "";

  adminStatus.textContent = "Modo ADM ativo: todas as skins liberadas.";
  adminStatus.style.color = "#176b2c";

  updateMenuStats();
}

function clearObstacles() {
  obstaclesContainer.innerHTML = "";
  game.obstacles = [];
}

function pauseObstacles(duration = 1250) {
  clearObstacles();
  game.obstaclePauseUntil = performance.now() + duration;
  game.distanceUntilNextObstacle = 820;
}

dinoImage.onload = () => {
  dino.classList.add("has-image");
};

dinoImage.onerror = () => {
  dino.classList.remove("has-image");
};

skinButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectSkin(button.dataset.skin);
  });
});

adminButton.addEventListener("click", () => {
  adminPanel.classList.toggle("active");

  if (adminPanel.classList.contains("active")) {
    adminCodeInput.focus();
  }
});

adminEnterButton.addEventListener("click", activateAdminMode);

adminCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    activateAdminMode();
  }
});

playButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

backMenuButton.addEventListener("click", () => {
  endModal.classList.remove("active");
  gameScreen.classList.remove("active");
  menuScreen.classList.add("active");
  updateMenuStats();
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();

    if (game.running) {
      jump();
    }
  }
});

gameArea.addEventListener("pointerdown", () => {
  if (game.running) {
    jump();
  }
});

function startGame() {
  cancelAnimationFrame(game.rafId);

  ensureSelectedSkinIsAllowed();

  menuScreen.classList.remove("active");
  gameScreen.classList.add("active");
  endModal.classList.remove("active");
  obstaclesContainer.innerHTML = "";

  gameArea.className = "game-area";

  const initialScore = getAdminStartScore();

  game.running = true;
  game.won = false;
  game.score = initialScore;
  game.speed = 350;
  game.elapsedTime = 0;
  game.y = 0;
  game.velocityY = 0;
  game.onGround = true;
  game.obstacles = [];
  game.lastTime = performance.now();
  game.distanceUntilNextObstacle = 720;
  game.obstaclePauseUntil = 0;
  game.groundOffset = 0;
  game.bgOffset = 0;
  game.currentFrame = 0;
  game.lastFrameChange = 0;
  game.currentPhase = 0;

  applyPhaseByScore(initialScore);

  currentScoreEl.textContent = Math.floor(game.score);
  bestScoreEl.textContent = getRecord();
  startMessage.classList.remove("hidden");

  setTimeout(() => {
    startMessage.classList.add("hidden");
  }, 700);

  setDinoFrame(0);
  dino.style.transform = "translateY(0px)";

  game.rafId = requestAnimationFrame(updateGame);
}

function updateGame(now) {
  if (!game.running) return;

  const deltaTime = Math.min(now - game.lastTime, 32);
  game.lastTime = now;

  updateScore(deltaTime);
  updateSpeed(deltaTime);
  updateDino(deltaTime);
  updateDinoAnimation(now);
  updateObstacles(deltaTime, now);
  updateBackground(deltaTime);
  checkPhaseTransitions();
  updateHud();

  if (checkAllCollisions()) {
    finishGame(false);
    return;
  }

  game.rafId = requestAnimationFrame(updateGame);
}

function updateScore(deltaTime) {
  game.score += deltaTime * 0.08;
}

function updateSpeed(deltaTime) {
  game.elapsedTime += deltaTime / 1000;

  const scoreProgress = Math.min(1, game.score / 50000);
  const timeProgress = Math.min(1, game.elapsedTime / 180);

  game.speed = 350 + scoreProgress * 350 + timeProgress * 90;
}

function updateHud() {
  currentScoreEl.textContent = Math.floor(game.score);
  bestScoreEl.textContent = getRecord();
}

function checkPhaseTransitions() {
  if (game.score >= 10000 && game.currentPhase === 0) {
    triggerPhaseChange("phase-1", 1);
  } else if (game.score >= 20000 && game.currentPhase === 1) {
    triggerPhaseChange("phase-2", 2);
  } else if (game.score >= 30000 && game.currentPhase === 2) {
    triggerPhaseChange("phase-3", 3);
  }
}

function triggerPhaseChange(className, phaseId) {
  game.currentPhase = phaseId;

  pauseObstacles(1250);

  gameArea.classList.add("phase-flash");

  setTimeout(() => {
    gameArea.classList.add(className);
  }, 250);

  setTimeout(() => {
    gameArea.classList.remove("phase-flash");
  }, 500);
}

function updateDino(deltaTime) {
  const timeScale = deltaTime / 16.67;

  if (!game.onGround || game.velocityY > 0) {
    game.y += game.velocityY * timeScale;
    game.velocityY -= game.gravity * timeScale;

    if (game.y <= 0) {
      game.y = 0;
      game.velocityY = 0;
      game.onGround = true;
    }
  }

  dino.style.transform = `translateY(${-game.y}px)`;
}

function updateDinoAnimation(now) {
  if (!game.onGround) {
    setDinoFrame(0);
    return;
  }

  const animationSpeed = Math.max(60, 125 - (game.speed - 350) * 0.09);

  if (now - game.lastFrameChange > animationSpeed) {
    game.currentFrame = game.currentFrame === 0 ? 1 : 0;
    game.lastFrameChange = now;
    setDinoFrame(game.currentFrame);
  }
}

function jump() {
  if (!game.onGround) return;

  game.onGround = false;
  game.velocityY = game.jumpForce;
}

function updateObstacles(deltaTime, now) {
  if (now < game.obstaclePauseUntil) {
    return;
  }

  const distanceTraveled = game.speed * (deltaTime / 1000);
  game.distanceUntilNextObstacle -= distanceTraveled;

  if (game.distanceUntilNextObstacle <= 0) {
    createObstacle();
    game.distanceUntilNextObstacle = getNextObstacleDistance();
  }

  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    const obstacle = game.obstacles[i];
    obstacle.x -= distanceTraveled;
    obstacle.element.style.transform = `translateX(${obstacle.x}px)`;

    if (obstacle.x < -obstacle.width - 80) {
      obstacle.element.remove();
      game.obstacles.splice(i, 1);
    }
  }
}

function getNextObstacleDistance() {
  const speedProgress = Math.min(1, Math.max(0, (game.speed - 350) / 440));

  const minDistance = 440 + speedProgress * 340;
  const maxDistance = 740 + speedProgress * 500;

  return random(minDistance, maxDistance);
}

function createObstacle() {
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

  const element = document.createElement("div");
  element.className = `obstacle ${type.name}`;
  element.style.width = `${type.width}px`;
  element.style.height = `${type.height}px`;

  const img = document.createElement("img");
  img.src = type.image;
  img.alt = `obstáculo ${type.name}`;

  img.onload = () => {
    element.classList.add("loaded");
  };

  img.onerror = () => {
    img.style.display = "none";
  };

  element.appendChild(img);
  obstaclesContainer.appendChild(element);

  const startX = gameArea.clientWidth + 40;

  const obstacle = {
    element,
    x: startX,
    width: type.width,
    height: type.height,
    collisionBox: type.collisionBox
  };

  element.style.transform = `translateX(${startX}px)`;
  game.obstacles.push(obstacle);
}

function updateBackground(deltaTime) {
  game.groundOffset -= game.speed * (deltaTime / 1000);
  game.bgOffset -= (game.speed * 0.22) * (deltaTime / 1000);

  ground.style.backgroundPositionX = `${game.groundOffset}px`;
  gameArea.style.backgroundPosition = `${game.bgOffset}px bottom, center`;
}

function checkAllCollisions() {
  if (performance.now() < game.obstaclePauseUntil) {
    return false;
  }

  for (const obstacle of game.obstacles) {
    if (isColliding(obstacle)) {
      return true;
    }
  }

  return false;
}

function isColliding(obstacle) {
  const areaHeight = gameArea.clientHeight;

  const dinoLeft = dino.offsetLeft + 14;
  const dinoRight = dino.offsetLeft + dino.offsetWidth - 10;
  const dinoBottom = areaHeight - GROUND_HEIGHT - game.y - 3;
  const dinoTop = dinoBottom - dino.offsetHeight + 15;

  const box = obstacle.collisionBox;

  const obstacleLeft = obstacle.x + box.x;
  const obstacleRight = obstacleLeft + box.width;
  const obstacleTop = areaHeight - GROUND_HEIGHT - obstacle.height + box.y;
  const obstacleBottom = obstacleTop + box.height;

  return (
    dinoRight > obstacleLeft &&
    dinoLeft < obstacleRight &&
    dinoBottom > obstacleTop &&
    dinoTop < obstacleBottom
  );
}

function finishGame(won) {
  game.running = false;
  game.won = won;

  cancelAnimationFrame(game.rafId);

  const finalScore = Math.floor(game.score);
  saveRound(finalScore);

  endTitle.textContent = "Fim de jogo";
  endText.textContent = `Você fez ${finalScore} pontos.`;

  endModal.classList.add("active");
  updateMenuStats();
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

updateMenuStats();
updateSkinSelection();
setDinoFrame(0);