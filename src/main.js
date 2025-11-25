// main.js - 應用程式主入口與協調器

// --- 模組引入 ---
import { initFirebase, initAuth, loadProfile, saveProfile } from './js/firebase.js';
import { GAME_CONFIG } from './js/config.js';
import { createRenderer } from './js/renderer.js';
import * as UI from './js/ui.js';
import * as Game from './js/game.js';

import { 
    canvas, inputName, btn1P, btnInf, btn2P, btnConfirmChar, btnRestart, btnExitGame,
    btnOpenSettings, btnCloseSettings, settingsModal, inputRotate, inputBounce, valBounce,
    btnColPrev, btnColNext, colPreview, lockOverlay, lockMsg, btnUploadBg, bgUploadInput,
    cardX2, cardBig, btnLockPos, gameWrapper, btnViewHistory, btnCloseHistory, historyModal,
    gameContainer, uiLayer, startScreen, charSelectScreen, gameOverScreen, getElement
} from './js/dom.js';


// --- 全域狀態 ---
let currentUser = null,
    currentPlayerName = "",
    localHighScore = 0,
    isGoldUnlocked = false,
    p1Color = '#e67e22',
    customBgImage = null,
    isRotated = false;
let pendingMode = { players: 1, infinite: false };
const renderer = createRenderer(canvas);
let particles = [], floatScores = [];

// --- 初始化 ---
async function initializeApp() {
    initFirebase();
    currentUser = await initAuth();
    const profile = await loadProfile();
    if (profile) {
        localHighScore = Math.max(localHighScore, profile.highScore || 0);
        isGoldUnlocked = isGoldUnlocked || profile.skinGold || false;
        if (profile.playerName) inputName.value = profile.playerName;
    }
    localHighScore = Math.max(localHighScore, parseInt(localStorage.getItem('bs_highscore')) || 0);
    isGoldUnlocked = isGoldUnlocked || localStorage.getItem('bs_skin_gold') === 'true';
    const savedName = localStorage.getItem('bs_playername');
    if (savedName) inputName.value = savedName;

    UI.updateLocalHighScoreDisplay(localHighScore);
    UI.displayLeaderboard();
    resize();
    mainLoop();
}

// --- 視窗調整 ---
function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let s;
    if (isRotated) {
        s = Math.min(h / 960, w / 600) * 0.95;
        gameWrapper.style.transform = `rotate(90deg) scale(${s})`;
    } else {
        s = (h > w) ? (w / 960) * 0.95 : Math.min(w / 960, h / 600) * 0.95;
        gameWrapper.style.transform = `rotate(0deg) scale(${s})`;
    }
}
window.addEventListener('resize', resize);

// --- 設定 Modal ---
const ballColors = ['#e67e22', '#00e676', '#3498db', '#9b59b6', '#e91e63', '#ffd700'];
let ballColorIdx = 0;
function updateColorUI() {
    const c = ballColors[ballColorIdx];
    colPreview.style.backgroundColor = c;
    lockOverlay.classList.toggle('hidden', !(c === '#ffd700' && !isGoldUnlocked));
    lockMsg.innerText = (c === '#ffd700' && !isGoldUnlocked) ? "REACH TOP 5" : "";
}
function applySettings() {
    GAME_CONFIG.PHYSICS.BALL_BOUNCE = inputBounce.value / 10;
    const selectedColor = ballColors[ballColorIdx];
    if (selectedColor === '#ffd700' && !isGoldUnlocked) {
        p1Color = ballColors[0]; ballColorIdx = 0;
    } else {
        p1Color = selectedColor;
    }
    if (inputRotate.checked !== isRotated) {
        isRotated = inputRotate.checked;
        resize();
    }
}

// --- 事件綁定 ---
function setPlayerName() {
    let n = inputName.value.trim().toUpperCase();
    if (n) {
        localStorage.setItem('bs_playername', n);
        currentPlayerName = n;
        saveProfile({ playerName: n });
    }
}
btn1P.onclick = () => { setPlayerName(); pendingMode = { players: 1, infinite: false }; Game.setGameState(Game.STATE.CHAR_SELECT); };
btnInf.onclick = () => { setPlayerName(); pendingMode = { players: 1, infinite: true }; Game.setGameState(Game.STATE.CHAR_SELECT); };
btn2P.onclick = () => { pendingMode = { players: 2, infinite: false }; Game.setGameState(Game.STATE.CHAR_SELECT); };
btnConfirmChar.onclick = () => { 
    UI.setupGameUI(pendingMode.infinite, pendingMode.players);
    Game.startGame(pendingMode.players, pendingMode.infinite); 
    UI.updateTopBarUI(Game); // Immediately update UI after state is initialized
};
btnRestart.onclick = () => { Game.setGameState(Game.STATE.MENU); UI.showStartScreenUI(); };
btnExitGame.onclick = (e) => { e.stopPropagation(); Game.setGameState(Game.STATE.MENU); UI.showStartScreenUI(); };
cardX2.onclick = (e) => { e.stopPropagation(); Game.usePowerup('x2'); };
cardBig.onclick = (e) => { e.stopPropagation(); Game.usePowerup('big'); };
btnOpenSettings.onclick = () => { settingsModal.classList.remove('hidden'); updateColorUI(); };
btnCloseSettings.onclick = () => { settingsModal.classList.add('hidden'); applySettings(); };
btnViewHistory.onclick = () => { settingsModal.classList.add('hidden'); UI.showHistory(); };
btnCloseHistory.onclick = () => historyModal.classList.add('hidden');
btnColPrev.onclick = () => { ballColorIdx = (ballColorIdx - 1 + ballColors.length) % ballColors.length; updateColorUI(); };
btnColNext.onclick = () => { ballColorIdx = (ballColorIdx + 1) % ballColors.length; updateColorUI(); };
inputBounce.oninput = () => valBounce.innerText = (inputBounce.value / 10).toFixed(1);
btnLockPos.onclick = (e) => { e.stopPropagation(); Game.confirmPosition(); };
window.selectChar = (c) => {
    Game.setSelectedChar(c);
    document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
    getElement('char-' + c).classList.add('selected');
};
bgUploadInput.onchange = (e) => {
    const f = e.target.files[0];
    if(f) {
        const r = new FileReader();
        r.onload = (ev) => { const i = new Image(); i.onload = () => { customBgImage = i; btnUploadBg.innerText = "BG SET! ✅"; }; i.src = ev.target.result; };
        r.readAsDataURL(f);
    }
};
btnUploadBg.onclick = () => bgUploadInput.click();

// --- 遊戲輸入 ---
let moveLeft = false, moveRight = false, isDragging = false;
window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.modal-overlay, .settings-btn, .rank-btn, .pos-lock-btn, .char-card, #btn-confirm-char')) return;
    if (Game.gameState === Game.STATE.POS || Game.gameState === Game.STATE.PICKUP) isDragging = true;
    else if (Game.gameState === Game.STATE.AIMING) Game.handleGameInput();
});
window.addEventListener('pointermove', (e) => {
    if (isDragging && (Game.gameState === Game.STATE.POS || Game.gameState === Game.STATE.PICKUP)) {
        let rect = gameWrapper.getBoundingClientRect(), scaleX = 960 / rect.width;
        let inputX = (e.clientX - rect.left) * scaleX;
        let maxR = Game.isInfinite ? canvas.width - 50 : GAME_CONFIG.COURT.THREE_POINT_X + 200;
        Game.setPlayerX(Math.max(50, Math.min(maxR, inputX)));
    }
});
window.addEventListener('pointerup', () => isDragging = false);
window.addEventListener('keydown', (e) => {
    if (inputName === document.activeElement) return;
    if (e.code === 'Space') {
        e.preventDefault();
        if (Game.gameState === Game.STATE.POS) Game.confirmPosition();
        else if (Game.gameState === Game.STATE.AIMING) Game.handleGameInput();
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); moveLeft = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); moveRight = true; }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = false;
});


// --- 遊戲主迴圈 ---
let previousGameState = -1;
function mainLoop() {
    // 0. 偵測狀態改變，執行一次性動作
    if (Game.gameState !== previousGameState) {
        if (Game.gameState === Game.STATE.CHAR_SELECT) {
            renderer.renderCharPreview('preview-curry', 'curry');
            renderer.renderCharPreview('preview-lbj', 'lbj');
        }
        previousGameState = Game.gameState;
    }

    // 1. 更新遊戲邏輯
    Game.updateGameState();
    
    // 2. 處理遊戲事件
    const events = Game.popGameEvents();
    events.forEach(event => {
        switch (event.type) {
            case 'SHOW_MSG': UI.showMsg(event.text, event.color); break;
            case 'SHOW_TURN_MSG': UI.showTurnMessage(event.text, event.color); break;
            case 'SPAWN_FLOAT_SCORE': UI.spawnFloatScore(floatScores, event.points, event.x, event.y, event.text); break;
            case 'SPAWN_PARTICLES': UI.spawnParticles(particles, event.x, event.y, event.count, event.colors); break;
            case 'SHAKE_SCREEN': gameContainer.classList.add('shake'); setTimeout(() => gameContainer.classList.remove('shake'), 500); break;
            case 'SCORE_UPDATED':
            case 'ITEM_COLLECTED':
            case 'BALL_LAUNCHED':
            case 'NEW_TURN':
                UI.updateTopBarUI(Game);
                break;
            case 'POWERUP_TOGGLED':
                UI.updatePowerupUI(Game);
                UI.applyHoopSize(Game.currP, Game.HOOP, GAME_CONFIG);
                UI.updateTopBarUI(Game);
                break;
            case 'AIMING_START':
            case 'BALL_PICKED_UP':
                 UI.toggleTutorial(false);
                 UI.togglePositionUI(Game.gameState === Game.STATE.POS);
                 break;
            case 'ROUND_START':
                 UI.updatePowerupUI(Game);
                 UI.applyHoopSize(Game.currP, Game.HOOP, GAME_CONFIG);
                 UI.updateTopBarUI(Game);
                 break;
            case 'GAME_OVER':
                UI.endGameUI({ ...Game, localHighScore, currentUser, currentPlayerName, isGoldUnlocked, updateLocalHighScoreDisplay: (s) => {localHighScore=s; UI.updateLocalHighScoreDisplay(s)} });
                break;
        }
    });

    // 3. 根據狀態更新 UI
    if (moveLeft || moveRight) {
        let s = GAME_CONFIG.CHARACTERS[Game.selectedChar].speed;
        let currentX = Game.player.x;
        if (moveLeft) currentX -= s; if (moveRight) currentX += s;
        let maxR = Game.isInfinite ? canvas.width - 50 : GAME_CONFIG.COURT.THREE_POINT_X + 200;
        Game.setPlayerX(Math.max(50, Math.min(maxR, currentX)));
    }
    if (Game.heldBallIndex !== -1) Game.setHeldBallPosition();
    
    UI.updateParticles(particles);
    UI.updateFloatScores(floatScores);

    // 根據遊戲狀態顯示不同畫面
    startScreen.classList.toggle('hidden', Game.gameState !== Game.STATE.MENU);
    charSelectScreen.classList.toggle('hidden', Game.gameState !== Game.STATE.CHAR_SELECT);
    gameOverScreen.classList.toggle('hidden', Game.gameState !== Game.STATE.OVER);
    const isInGame = Game.gameState !== Game.STATE.MENU && Game.gameState !== Game.STATE.CHAR_SELECT && Game.gameState !== Game.STATE.OVER;
    uiLayer.style.display = isInGame ? 'block' : 'none';
    btnOpenSettings.style.display = (Game.gameState === Game.STATE.MENU) ? 'flex' : 'none';

    if(Game.gameState < Game.STATE.OVER) {
         UI.updateCountdownWarning(Game.infiniteTimer);
         UI.togglePositionUI(Game.gameState === Game.STATE.POS);
         if(Game.gameState === Game.STATE.POS) UI.toggleTutorial(true, "DRAG OR USE ARROWS TO MOVE");
         else if(Game.gameState === Game.STATE.PICKUP) UI.toggleTutorial(true, "GET THE BALL!");
         else UI.toggleTutorial(false);
    }
    
    // 4. 渲染畫面
    renderer.render({ ...Game, particles, floatScores, p1Color, customBgImage });

    // 5. 進入下一幀
    requestAnimationFrame(mainLoop);
}

// --- 啟動 ---
initializeApp();