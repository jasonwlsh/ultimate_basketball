// src/js/ui.js

import * as DOM from './dom.js';
import { escapeHtml } from './utils.js';
import { fetchScoreHistory, fetchLeaderboard, uploadScore, saveProfile } from './firebase.js';

// --- 分數與排行榜 UI ---

export async function displayLeaderboard() {
    const leaderboard = await fetchLeaderboard();
    if (leaderboard === null) {
        DOM.startLbContent.innerHTML = '<div class="slb-loading">ERROR</div>';
        return;
    }
    if (leaderboard.length === 0) {
        DOM.startLbContent.innerHTML = '<div class="slb-loading">NO RECORDS YET.</div>';
        return;
    }
    let h = '<table class="start-lb-table">';
    leaderboard.forEach((x, i) => {
        let c = i === 0 ? '#ffd700' : (i === 1 ? '#c0c0c0' : (i === 2 ? '#cd7f32' : '#777'));
        h += `<tr><td class="slb-rank" style="color:${c}">${i+1}.</td><td class="slb-name">${escapeHtml(x.name)}</td><td class="slb-score">${x.score}</td></tr>`;
    });
    h += '</table>';
    DOM.startLbContent.innerHTML = h;
}

export async function showHistory() {
    DOM.historyContentEl.innerHTML = '<div class="history-loading">LOADING HISTORY...</div>';
    DOM.historyModal.classList.remove('hidden');
    const history = await fetchScoreHistory();
    if (history === null) {
        DOM.historyContentEl.innerHTML = '<div class="history-loading">ERROR</div>';
        return;
    }
    if (history.length === 0) {
        DOM.historyContentEl.innerHTML = '<div class="history-loading">NO HISTORY YET. START SHOOTING!</div>';
        return;
    }
    let html = '<table class="history-table"><thead><tr><td class="hist-time">TIME</td><td class="hist-name">NAME</td><td class="hist-score">SCORE</td></tr></thead><tbody>';
    history.forEach(d => {
        html += `<tr><td class="hist-time">${d.time}</td><td class="hist-name">${d.name}</td><td class="hist-score">${d.score}</td></tr>`;
    });
    html += '</tbody></table>';
    DOM.historyContentEl.innerHTML = html;
}

export async function handleScoreUpload(name, score, isGoldUnlocked) {
    DOM.rankResultBox.classList.add('show');
    DOM.rankStatusText.innerText = "CHECKING GLOBAL RANK...";
    DOM.rankValText.innerHTML = '<span class="rank-loading">...</span>';
    DOM.rankPercentileText.innerText = "";
    DOM.skinUnlockMsg.classList.add('hidden');

    const result = await uploadScore(name, score, isGoldUnlocked);
    let newSkinUnlocked = false;

    if (result.error) {
        DOM.rankStatusText.innerText = "CONNECTION ERROR";
        DOM.rankValText.innerText = "OFFLINE";
    } else if (result.isNewRecord) {
        DOM.rankStatusText.innerText = "NEW RECORD!";
        DOM.rankStatusText.style.color = "#ffd700";
        DOM.rankValText.innerHTML = `GLOBAL RANK #${result.rank}`;
        DOM.rankValText.style.color = "#00e676";
        DOM.rankPercentileText.innerText = `BETTER THAN ${result.percentile}% OF USERS`;
        if (result.newSkinUnlocked) {
            newSkinUnlocked = true;
            DOM.skinUnlockMsg.classList.remove('hidden');
        }
    } else {
        DOM.rankStatusText.innerText = "SCORE LOGGED";
        DOM.rankStatusText.style.color = "#bdc3c7";
        DOM.rankValText.innerHTML = `BEST: ${result.best}`;
        DOM.rankValText.style.color = "#7f8c8d";
    }
    displayLeaderboard();
    return newSkinUnlocked;
}


// --- 遊戲畫面切換 ---

export function showStartScreenUI() {
    DOM.gameOverScreen.classList.add('hidden');
    DOM.charSelectScreen.classList.add('hidden');
    DOM.startScreen.classList.remove('hidden');
    DOM.uiLayer.style.display = 'none';
    DOM.btnOpenSettings.style.display = 'flex';
    displayLeaderboard();
}

export function showCharSelectUI() {
    DOM.startScreen.classList.add('hidden');
    DOM.charSelectScreen.classList.remove('hidden');
}

/**
 * 根據遊戲模式設定遊戲介面的初始狀態
 * @param {boolean} isInfinite - 是否為無限模式
 * @param {number} numPlayers - 玩家人數
 */
export function setupGameUI(isInfinite, numPlayers) {
    DOM.p2Panel.style.display = numPlayers === 2 ? 'flex' : 'none';
    DOM.getElement('ballDisplayP2').classList.toggle('hidden', numPlayers !== 2);
    DOM.getElement('p2-end-score').style.display = numPlayers === 2 ? 'block' : 'none';

    const powerupBar = DOM.getElement('game-container').querySelector('.powerup-bar');

    if (isInfinite) {
        DOM.ballLabelP1.innerText = "TIME";
        DOM.ballEl.classList.add('large-timer');
        if(powerupBar) powerupBar.style.display = 'flex';
        showTurnMessage("INFINITE MODE!", "#f1c40f");
    } else {
        DOM.ballLabelP1.innerText = "P1 BALLS";
        DOM.ballEl.classList.remove('large-timer');
        if(powerupBar) powerupBar.style.display = 'flex';
    }
}

/**
 * 顯示遊戲結束畫面
 * @param {object} data - 包含 p1, p2, isInfinite, numPlayers 的物件
 */

export function endGameUI(data) {
    const { p1, p2, isInfinite, numPlayers, localHighScore, currentUser, currentPlayerName, isGoldUnlocked, updateLocalHighScoreDisplay } = data;
    
    DOM.posUI.classList.add('hidden');
    DOM.countdownWarning.style.display = 'none';
    DOM.getElement('end-p1').innerText = p1.score;
    DOM.getElement('end-p2').innerText = p2.score;
    
    let title = isInfinite ? "TIME'S UP!" : "GAME OVER";
    DOM.newRecordMsg.classList.add('hidden');
    DOM.rankResultBox.classList.remove('show');
    DOM.rankPercentileText.innerText = "";

    if (numPlayers === 1) {
        if (p1.score > localHighScore) {
            localStorage.setItem('bs_highscore', p1.score);
            DOM.newRecordMsg.classList.remove('hidden');
            updateLocalHighScoreDisplay(p1.score);
        }
        if (p1.score > 0 && currentUser) {
            handleScoreUpload(currentPlayerName, p1.score, isGoldUnlocked).then(newSkinUnlocked => {
                if(newSkinUnlocked || p1.score > localHighScore) {
                    saveProfile({
                        highScore: Math.max(localHighScore, p1.score),
                        skinGold: isGoldUnlocked || newSkinUnlocked,
                        playerName: currentPlayerName
                    });
                }
            });
        }
    } else {
        if (p1.score > p2.score) title = "P1 WINS!";
        else if (p2.score > p1.score) title = "P2 WINS!";
        else title = "DRAW GAME";
    }
    
    DOM.getElement('go-title').innerText = title;
    DOM.gameOverScreen.classList.remove('hidden');
}


// --- 遊戲中 UI 更新 ---

export function updateTopBarUI({ p1, p2, isInfinite, infiniteTimer, turnPlayer, currP }) {
    DOM.scoreP1El.innerText = p1.score;
    DOM.scoreP2El.innerText = p2.score;
    
    if (!isInfinite) {
        DOM.ballEl.innerText = p1.balls;
        DOM.ballElP2.innerText = p2.balls;
    } else {
        DOM.ballEl.innerText = Math.ceil(infiniteTimer) + "s";
    }

    DOM.p1Panel.classList.toggle('active', turnPlayer === 1);
    DOM.p2Panel.classList.toggle('active', turnPlayer === 2);

    DOM.fireVal.classList.toggle('show', currP.streak >= 3);
    DOM.rainbowVal.classList.toggle('show', currP.usingRainbow);
    
    if(currP.streak >= 3) currP.isFireball = true;
    else currP.isFireball = false;

    DOM.x2Val.classList.toggle('show', currP.pu_x2.active);
}

export function updateLocalHighScoreDisplay(score) {
    DOM.menuBestEl.innerText = score;
}

export function updatePowerupUI({ currP }) {
    updateCardStyle(DOM.cardX2, currP.pu_x2, DOM.countX2El);
    updateCardStyle(DOM.cardBig, currP.pu_big, DOM.countBigEl);
}

function updateCardStyle(element, data, countElement) {
    element.classList.toggle('active', data.active);
    element.classList.toggle('disabled', data.count <= 0);
    countElement.innerText = "x" + data.count;
}

export function applyHoopSize(currP, HOOP, config) {
    if (currP.pu_big.active) {
        HOOP.w = 110;
        HOOP.x = config.COURT.HOOP_X - 40;
    } else {
        HOOP.w = config.COURT.HOOP_W;
        HOOP.x = config.COURT.HOOP_X;
    }
}

export function consumePowerups(currP) {
    if (currP.pu_x2.active) {
        currP.pu_x2.count--;
        DOM.x2Val.classList.remove('show');
    }
    if (currP.pu_big.active) {
        currP.pu_big.count--;
    }
    updatePowerupUI({ currP });
}

export function resetPowerupsForRound(currP, HOOP, config) {
    currP.pu_x2.active = false;
    currP.pu_big.active = false;
    DOM.x2Val.classList.remove('show');
    updatePowerupUI({ currP });
    applyHoopSize(currP, HOOP, config);
}


// --- UI 特效 ---

export function showMsg(text, color) {
    DOM.msgEl.innerText = text;
    DOM.msgEl.style.color = color;
    DOM.msgEl.className = 'pop';
    setTimeout(() => DOM.msgEl.classList.remove('pop'), 800);
}

export function showTurnMessage(text, color) {
    DOM.turnMsg.innerText = text;
    DOM.turnMsg.style.color = color;
    DOM.turnMsg.classList.add('show');
    setTimeout(() => DOM.turnMsg.classList.remove('show'), 1500);
}

export function spawnParticles(particles, x, y, count, colors) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1,
            col: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

export function updateParticles(particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life -= 0.05;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

export function spawnFloatScore(floatScores, points, x, y, text) {
    floatScores.push({
        val: points,
        text: text,
        x: x, y: y,
        life: 1.0
    });
}

export function updateFloatScores(floatScores) {
    for (let i = floatScores.length - 1; i >= 0; i--) {
        floatScores[i].y -= 1;
        floatScores[i].life -= 0.02;
        if (floatScores[i].life <= 0) floatScores.splice(i, 1);
    }
}

export function toggleTutorial(show, text = '') {
    if (show) {
        DOM.tutorialMsg.innerText = text;
        DOM.tutorialMsg.classList.remove('hidden');
    } else {
        DOM.tutorialMsg.classList.add('hidden');
    }
}

export function togglePositionUI(show) {
    DOM.posUI.classList.toggle('hidden', !show);
}

export function updateCountdownWarning(timer) {
    if (timer <= 10 && timer > 0) {
        DOM.countdownWarning.innerText = Math.ceil(timer);
        DOM.countdownWarning.style.display = 'block';
        DOM.countdownWarning.style.color = timer <= 3 ? '#ff0000' : '#f1c40f';
    } else {
        DOM.countdownWarning.style.display = 'none';
    }
}
