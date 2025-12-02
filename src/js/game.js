// src/js/game.js

/**
 * 遊戲核心邏輯
 * 負責管理遊戲狀態、物件、物理與碰撞等。
 * 這個模組不應該直接操作 DOM 或呼叫 UI 函式。
 */
import { GAME_CONFIG } from './config.js';

// --- 遊戲狀態管理 ---
export const STATE = {
    POS: 0, AIMING: 1, FLYING: 2, RESET: 3, OVER: 4, 
    MENU: 5, PICKUP: 6, CHAR_SELECT: 7, DUNKING: 8
};
export let gameState = STATE.MENU;
export let numPlayers = 1, turnPlayer = 1, isInfinite = false, infiniteTimer = 60;

// --- 玩家資料 ---
const defaultPlayerData = () => ({
    score: 0,
    balls: GAME_CONFIG.GAME.TOTAL_BALLS_CLASSIC,
    streak: 0,
    isFireball: false,
    hasRainbow: false,
    usingRainbow: false,
    pu_x2: { count: 2, active: false },
    pu_big: { count: 2, active: false },
    shotsCount: 0
});
export let p1 = defaultPlayerData(), p2 = defaultPlayerData();
export let currP = p1;

// --- 遊戲物件 ---
export let player = { x: 100, y: GAME_CONFIG.PHYSICS.GROUND_Y, vx: 0, vy: 0, onGround: true };
export let aimOscillator = 0, aimDirection = 1, dunkHangTimer = 0;
export let HOOP = {
    x: GAME_CONFIG.COURT.HOOP_X, y: GAME_CONFIG.COURT.HOOP_Y, w: GAME_CONFIG.COURT.HOOP_W,
    rimR: 4, backX: 880, backW: 10, backH: 110
};
export let balls = [], heldBallIndex = -1;
export let floatingItem = { active: false, x: 0, y: 0, type: 'rainbow', offset: 0, dir: 1, scale: 0, spawning: false };
export let neonZone = { active: false, x: 0, w: 100, timer: 0, cooldown: 0 };
export let selectedChar = 'curry';
export let hue = 0;

// --- 事件佇列 ---
// 儲存遊戲邏輯中發生的事件，由主迴圈取出並交給 UI 模組處理
let gameEvents = [];
export const popGameEvents = () => {
    const events = [...gameEvents];
    gameEvents = [];
    return events;
};

// --- 遊戲流程 ---
export function startGame(p, inf) {
    numPlayers = p;
    turnPlayer = 1;
    isInfinite = inf;
    infiniteTimer = GAME_CONFIG.GAME.INFINITE_TIME;
    p1 = defaultPlayerData();
    p2 = defaultPlayerData();
    currP = p1;
    if (isInfinite) {
        neonZone.active = false;
        neonZone.cooldown = 0;
        spawnNeonZone();
    }
    startTurn();
}

export function startTurn() {
    currP = (turnPlayer === 1) ? p1 : p2;
    if (currP.hasRainbow) {
        currP.usingRainbow = true;
        currP.hasRainbow = false;
    } else {
        currP.usingRainbow = false;
    }
    gameEvents.push({ type: 'NEW_TURN' });
    if (numPlayers === 2) {
        gameEvents.push({ type: 'SHOW_TURN_MSG', text: `P${turnPlayer} START!`, color: turnPlayer === 1 ? '#f1c40f' : '#00ffff' });
    }
    resetRound(true);
}

function endGame() {
    gameState = STATE.OVER;
    gameEvents.push({ type: 'GAME_OVER' });
}

function resetRound(isNew = false) {
    if (!isInfinite) {
        if (p1.balls <= 0 && (numPlayers === 1 || p2.balls <= 0)) {
            endGame(); return;
        }
        if (!isNew && numPlayers === 2) {
            if ((turnPlayer === 1 && p2.balls > 0) || (turnPlayer === 1 && p1.balls <= 0)) {
                turnPlayer = 2; setTimeout(startTurn, 100); return;
            } else if ((turnPlayer === 2 && p1.balls > 0) || (turnPlayer === 2 && p2.balls <= 0)) {
                turnPlayer = 1; setTimeout(startTurn, 100); return;
            }
        }
    } else {
        if (infiniteTimer <= 0) {
            endGame(); return;
        }
    }
    if (numPlayers === 1 && !isNew) {
        currP.usingRainbow = currP.hasRainbow;
        if(currP.hasRainbow) currP.hasRainbow = false;
    }
    
    // 重設道具
    currP.pu_x2.active = false;
    currP.pu_big.active = false;

    balls = [];
    heldBallIndex = -1;

    if (isInfinite) {
        balls.push(spawnBall(40, 240, GAME_CONFIG.GAME.PIPE_BALL_SPEED, -2));
        gameState = STATE.PICKUP;
    } else {
        player.x = 100 + Math.random() * 100;
        player.y = GAME_CONFIG.PHYSICS.GROUND_Y;
        player.vx = 0; player.vy = 0; player.onGround = true;
        let b = spawnBall(player.x + 14, player.y - 35, 0, 0);
        b.held = true;
        b.isThree = player.x < GAME_CONFIG.COURT.THREE_POINT_X;
        balls.push(b);
        heldBallIndex = 0;
        gameState = STATE.POS;
    }

    if (!isInfinite) {
        if (currP.shotsCount === 1) spawnFloatingItem('rainbow');
        else if (currP.shotsCount === 5) spawnFloatingItem('ball');
        else floatingItem.active = false;
    } else floatingItem.active = false;
    
    gameEvents.push({ type: 'ROUND_START' });
}

// --- 輸入與動作 ---
export function confirmPosition() {
    if (gameState === STATE.POS && heldBallIndex !== -1) {
        gameState = STATE.AIMING;
        aimOscillator = 0;
        aimDirection = 1;
        gameEvents.push({ type: 'AIMING_START' });
    }
}

export function handleGameInput() {
    if (gameState === STATE.AIMING) launchBall();
}

function launchBall() {
    if (heldBallIndex === -1) return;

    let b = balls[heldBallIndex];
    let greenStart = getGreenZoneStart();
    const isGoldShot = Math.abs(aimOscillator - GAME_CONFIG.METER.GOLD_ZONE_START) < GAME_CONFIG.METER.GOLD_ZONE_TOLERANCE;
    const isGreenShot = Math.abs(aimOscillator - greenStart) < GAME_CONFIG.METER.GREEN_TOLERANCE;

    if (isGoldShot) {
        // --- GOLD SHOT = RISKY DUNK ---
        gameEvents.push({ type: 'SHOW_MSG', text: "賭一把!", color: "#ffd700" });
        b.isGreen = false;
        gameState = STATE.DUNKING;

        const t_flight = 25;
        const targetX = HOOP.x + HOOP.w / 2;
        const targetY = HOOP.y - 50;
        
        player.vx = (targetX - player.x) / t_flight;
        player.vy = (targetY - player.y) / t_flight;
        player.onGround = false;

    } else {
        // --- NORMAL OR GREEN SHOT ---
        if (isGreenShot) {
            gameEvents.push({ type: 'SHOW_MSG', text: "NICE!", color: "#2ecc71" });
            b.isGreen = true;
        } else {
            b.isGreen = false;
        }
        
        gameState = STATE.FLYING;
        if (!isInfinite) currP.balls--;
        currP.shotsCount++;

        if (currP.pu_x2.active) currP.pu_x2.count--;
        if (currP.pu_big.active) currP.pu_big.count--;

        let vel = calculateLaunchVelocity(aimOscillator, heldBallIndex);
        b.vx = vel.vx; 
        b.vy = vel.vy; 
        b.pickupTimer = 0.2;
        
        b.held = false;
        heldBallIndex = -1;
        
        player.vy = -12; 
        player.vx = -3; 
        player.onGround = false;
        gameEvents.push({ type: 'BALL_LAUNCHED' });
    }
}

export function usePowerup(type) {
    if (gameState !== STATE.AIMING && gameState !== STATE.POS) return;
    let pk = 'pu_' + type, pu = currP[pk];
    if (pu.count > 0) {
        const wasActive = pu.active;
        currP.pu_x2.active = false;
        currP.pu_big.active = false;
        pu.active = !wasActive;
        gameEvents.push({ type: 'POWERUP_TOGGLED' });
    }
}

// --- 物件邏輯 ---
function spawnBall(x, y, vx, vy) {
    return { x, y, r: 16, vx, vy, scored: false, isThree: false, hasHitSomething: false, hasHitRim: false, hasHitBoard: false, minDistToHoop: 9999, held: false, isZoneShot: false, isGreen: false, active: true, scoreTimer: 0, pickupTimer: 0 };
}
function recycleBall(b) {
    b.x = 40; b.y = 240; b.vx = GAME_CONFIG.GAME.PIPE_BALL_SPEED; b.vy = -2;
    b.scored = false; b.held = false; b.scoreTimer = 0; b.pickupTimer = 0;
    b.hasHitSomething = false; b.hasHitBoard = false; b.hasHitRim = false; b.isGreen = false;
}
function calculateLaunchVelocity(ov, ballIdx) {
    let b = balls[ballIdx];
    let distToHoop = HOOP.x - b.x;
    let powerMult = 0.2 + (ov * 1.0);
    let baseVx = distToHoop * 0.030;
    return { vx: baseVx * powerMult, vy: -15 - (powerMult * 12) };
}
export function getGreenZoneStart() {
    let dist = Math.abs(HOOP.x - player.x);
    let normalized = Math.min(dist, 700) / 700;
    return 0.7 - (normalized * 0.22);
}

// --- 特殊區域與道具 ---
function spawnNeonZone() {
    neonZone.active = true;
    let isThree = (selectedChar === 'curry') ? Math.random() < 0.8 : Math.random() < 0.2;
    if (isThree) neonZone.x = 50 + Math.random() * (GAME_CONFIG.COURT.THREE_POINT_X - 150);
    else neonZone.x = GAME_CONFIG.COURT.THREE_POINT_X + 50 + Math.random() * 150;
    neonZone.w = 80;
    neonZone.timer = GAME_CONFIG.GAME.HOT_ZONE_DURATION;
}
function spawnFloatingItem(type) {
    floatingItem.active = true; floatingItem.spawning = true; floatingItem.scale = 0;
    let minX = 150, maxX = HOOP.backX - 50;
    floatingItem.x = minX + Math.random() * (maxX - minX);
    floatingItem.y = 100 + Math.random() * 150;
    floatingItem.type = type;
    gameEvents.push({ type: 'SPAWN_FLOAT_SCORE', x: floatingItem.x, y: floatingItem.y, text: type === 'rainbow' ? "ITEM!" : "+1 BALL" });
}

// --- 碰撞與計分 ---
function checkCollisions(b) {
    if (!b.isGreen && b.x + b.r > HOOP.backX && b.x - b.r < HOOP.backX + HOOP.backW && b.y > HOOP.y - 80 && b.y < HOOP.y + 50 && b.vx > 0) {
        b.x = HOOP.backX - b.r;
        b.vx *= -GAME_CONFIG.PHYSICS.BALL_BOUNCE * 1.1;
        b.vy *= 0.9;
        b.hasHitSomething = true;
        b.hasHitBoard = true;
        gameEvents.push({ type: 'SHOW_MSG', text: "CLANK!", color: "#cfd8dc" });
    }
    if (!b.isGreen) {
        checkRimHit(b, { x: HOOP.x, y: HOOP.y });
        checkRimHit(b, { x: HOOP.x + HOOP.w, y: HOOP.y });
    }
    if (b.isGreen && !b.scored && Math.abs(b.x - (HOOP.x + HOOP.w / 2)) < 30 && b.y >= HOOP.y + 5 && b.y <= HOOP.y + 80) {
        handleScore(b);
    }
    if (!b.scored && b.vy > 0 && b.x > HOOP.x + b.r / 2 && b.x < HOOP.x + HOOP.w - b.r / 2 && b.y >= HOOP.y && b.y <= HOOP.y + 20) {
        handleScore(b);
    }
}
function checkRimHit(b, r) {
    const dx = b.x - r.x, dy = b.y - r.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < b.r + HOOP.rimR) {
        b.hasHitSomething = true; b.hasHitRim = true;
        const nx = dx / dist, ny = dy / dist, dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * GAME_CONFIG.PHYSICS.RIM_BOUNCE;
        b.vy = (b.vy - 2 * dot * ny) * GAME_CONFIG.PHYSICS.RIM_BOUNCE;
        b.x += nx * (((b.r + HOOP.rimR) - dist));
        b.y += ny * (((b.r + HOOP.rimR) - dist));
    }
}
function checkItemCollision() {
    floatingItem.active = false;
    let type = floatingItem.type, text = "";
    if (type === 'ball') { currP.balls++; text = "+1 BALL"; } 
    else if (type === 'rainbow') { currP.hasRainbow = true; text = "RAINBOW NEXT!"; }
    gameEvents.push({ type: 'SPAWN_FLOAT_SCORE', x: floatingItem.x, y: floatingItem.y, text });
    gameEvents.push({ type: 'SPAWN_PARTICLES', x: floatingItem.x, y: floatingItem.y, count: 15, colors: ['#00e676', '#fff'] });
    gameEvents.push({ type: 'ITEM_COLLECTED' });
}
function handleScore(b) {
    b.scored = true; b.scoreTimer = 3.0;
    currP.streak++;
    let pts = b.isThree ? 3 : 2;
    let mult = 1;
    if (currP.streak >= 3) mult *= 2; // isFireball
    if (currP.usingRainbow) mult *= 3;
    if (currP.pu_x2.active) mult *= 2;
    if (b.isZoneShot) mult *= 2;
    pts *= mult;
    let isSwish = !b.hasHitBoard && !b.hasHitRim && Math.abs(b.x - (HOOP.x + HOOP.w / 2)) < 10;
    pts += isSwish ? 1 : 0;
    currP.score += pts;

    let msg = isSwish ? "SWISH! +1" : "GOOD!", color = isSwish ? "#00e676" : "#fff";
    if (b.isThree) { msg = isSwish ? "3PT SWISH!" : "3 POINTER!"; color = "#f1c40f"; }
    if (currP.streak >= 3) { msg = "FIRE!"; color = "#e74c3c"; }
    if (currP.usingRainbow) { msg = "RAINBOW!!!"; color = `hsl(${hue}, 70%, 60%)`; }
    if (b.isZoneShot) { msg += " ZONE X2!"; color = "#e056fd"; }
    
    gameEvents.push({ type: 'SHOW_MSG', text: msg, color: color });
    if (currP.streak >= 3 || currP.usingRainbow || b.isZoneShot) {
        gameEvents.push({ type: 'SHAKE_SCREEN' });
    }
    gameEvents.push({ type: 'SPAWN_FLOAT_SCORE', points: pts, x: HOOP.x, y: HOOP.y });
    gameEvents.push({ type: 'SPAWN_PARTICLES', x: HOOP.x + HOOP.w / 2, y: HOOP.y, count: 30, colors: currP.usingRainbow ? [`hsl(${hue}, 70%, 60%)`] : ['#fff', '#ffd700'] });
    gameEvents.push({ type: 'SCORE_UPDATED' });
}
function handleAirball() {
    currP.streak = 0;
    gameEvents.push({ type: 'SHOW_MSG', text: "AIRBALL -1", color: '#e74c3c' });
    if (!isInfinite) currP.score = Math.max(0, currP.score - 1);
    gameEvents.push({ type: 'SPAWN_FLOAT_SCORE', points: -1, x: player.x, y: player.y - 50 });
    gameEvents.push({ type: 'SCORE_UPDATED' });
}

// --- 每幀更新 ---
export function updateGameState(dt) {
    const sixtyFpsDt = 1 / 60;
    const multiplier = dt / sixtyFpsDt;

    hue = (hue + 1) % 360;
    if (gameState === STATE.MENU || gameState === STATE.OVER || gameState === STATE.CHAR_SELECT) return;

    if (gameState === STATE.DUNKING) {
        if (heldBallIndex !== -1) {
            setHeldBallPosition();
            let b = balls[heldBallIndex];

            if (!b.scored) {
                // --- Flying Phase (Linear) ---
                const targetX = HOOP.x + HOOP.w / 2;
                
                // If player reaches or passes the target X, trigger the dunk.
                if (player.x >= targetX) {
                     player.vx = 0;
                     player.vy = 20; // Start dunking down
                     handleScore(b);
                     b.scored = true;
                     gameEvents.push({ type: 'SHAKE_SCREEN' });
                }
            } else {
                // --- Falling Phase (With Gravity) ---
                // After dunking, re-apply gravity for a natural fall.
                player.vy += GAME_CONFIG.PHYSICS.GRAVITY * multiplier;
            }

            if (player.onGround && b.scored && heldBallIndex !== -1) {
                gameState = STATE.RESET;
                balls[heldBallIndex].held = false;
                heldBallIndex = -1;
                resetRound(false);
            }
        }
    }

    let speedMultiplier = currP.usingRainbow ? 1.5 : 1.0;

    if (isInfinite) {
        infiniteTimer -= dt;
        if (infiniteTimer <= 0) { infiniteTimer = 0; endGame(); }
        if (neonZone.active) {
            neonZone.timer -= dt;
            if (neonZone.timer <= 0) { neonZone.active = false; neonZone.cooldown = GAME_CONFIG.GAME.HOT_ZONE_RESPAWN_DELAY; }
        } else {
            if (neonZone.cooldown > 0) neonZone.cooldown -= dt;
            else spawnNeonZone();
        }
    }
    
    if (heldBallIndex === -1) {
        let closestDist = 9999, closestIdx = -1;
        balls.forEach((b, idx) => {
            if (!b.held && b.scoreTimer <= 0 && b.pickupTimer <= 0) {
                let d = Math.abs(player.x - b.x); let h = player.y - b.y;
                if (d < 60 && h < 150 && h > -50 && d < closestDist) { closestDist = d; closestIdx = idx; }
            }
        });
        if (closestIdx !== -1) {
            heldBallIndex = closestIdx;
            let b = balls[closestIdx];
            b.held = true; b.scored = false; b.scoreTimer = 0; b.vx = 0; b.vy = 0;
            gameState = STATE.POS;
            gameEvents.push({ type: 'BALL_PICKED_UP' });
        }
    }

    if (isInfinite && balls.length < 5 && balls.filter(b => !b.scored).length < 2) {
        balls.push(spawnBall(40, 240, GAME_CONFIG.GAME.PIPE_BALL_SPEED, -2));
    }

    balls.forEach(b => {
        if (b.scoreTimer > 0) {
            b.scoreTimer -= dt;
            if (b.scoreTimer <= 0 && isInfinite) recycleBall(b);
        }
        if (b.pickupTimer > 0) b.pickupTimer -= dt;

        if (!b.held) {
            if (b.isGreen) {
                const cx = HOOP.x + HOOP.w / 2;
                const entryY = HOOP.y + 5; // Aim slightly higher in the hoop
                if (b.vy > 0) {
                    const inCorridor = (b.x > HOOP.x - 30 && b.x < HOOP.x + HOOP.w + 30 && b.y < HOOP.y + 60);
                    if (inCorridor) {
                        // Softer, gentler correction force
                        let nvx = b.vx * 0.8 + (cx - b.x) * 0.1; 
                        let nvy = b.vy * 0.9 + (entryY - b.y) * 0.12;
                        if (nvx > 10) nvx = 10; if (nvx < -10) nvx = -10;
                        if (nvy > 12) nvy = 12; if (nvy < -12) nvy = -12;
                        b.vx = nvx; b.vy = nvy;
                    } else {
                        b.vx = b.vx * 0.98 + (cx - b.x) * 0.008;
                    }
                }
            }
            b.vy += GAME_CONFIG.PHYSICS.GRAVITY * multiplier;
            b.x += b.vx * multiplier;
            b.y += b.vy * multiplier;
            if (isInfinite) {
                if (b.x < 16) { b.x = 16; b.vx *= -GAME_CONFIG.PHYSICS.WALL_BOUNCE_INFINITE; }
                if (b.x > 960 - 16) { b.x = 960 - 16; b.vx *= -GAME_CONFIG.PHYSICS.WALL_BOUNCE_INFINITE; }
            }
            b.vx *= Math.pow(GAME_CONFIG.PHYSICS.AIR_FRICTION, multiplier);
            b.vy *= Math.pow(GAME_CONFIG.PHYSICS.AIR_FRICTION, multiplier);

            if (Math.hypot(b.x - (HOOP.x + HOOP.w / 2), b.y - HOOP.y) < b.minDistToHoop) b.minDistToHoop = Math.hypot(b.x - (HOOP.x + HOOP.w / 2), b.y - HOOP.y);
            
            if (b.y + b.r > GAME_CONFIG.PHYSICS.GROUND_Y) {
                b.y = GAME_CONFIG.PHYSICS.GROUND_Y - b.r;
                b.vy *= -GAME_CONFIG.PHYSICS.BALL_BOUNCE;
                b.vx *= 0.9;
                if (!b.scored && !b.hasHitSomething && Math.abs(b.vy) < 1) {
                    if (!isInfinite) handleAirball();
                    b.hasHitSomething = true;
                }
            }
            checkCollisions(b);

            if (floatingItem.active) {
                const idx = b.x - floatingItem.x, idy = b.y - (floatingItem.y + floatingItem.offset);
                if (Math.sqrt(idx * idx + idy * idy) < b.r + 25) checkItemCollision();
            }

            if (b.vx !== 0 || b.vy !== 0) {
                if (currP.usingRainbow) gameEvents.push({ type: 'SPAWN_PARTICLES', x: b.x, y: b.y, count: 3, colors: [`hsl(${hue}, 70%, 60%)`] });
                else if (currP.streak >= 3) gameEvents.push({ type: 'SPAWN_PARTICLES', x: b.x, y: b.y, count: 2, colors: ['#ff5722', '#f1c40f'] });
            }
        }
    });
    
    if (gameState === STATE.AIMING) {
        aimOscillator += GAME_CONFIG.METER.SPEED * aimDirection * speedMultiplier * multiplier;
        if (aimOscillator >= 1 || aimOscillator <= 0) aimDirection *= -1;
    }
    
    if (floatingItem.active) {
        floatingItem.offset += floatingItem.dir * 0.5 * multiplier;
        if (Math.abs(floatingItem.offset) > 8) floatingItem.dir *= -1;
        if (floatingItem.spawning) {
            floatingItem.scale += 0.1 * multiplier;
            if (floatingItem.scale >= 1.2) { floatingItem.scale = 1; floatingItem.spawning = false; }
        }
    }

    if (!player.onGround) {
        if (gameState !== STATE.DUNKING) { // Only apply gravity if not dunking
            player.vy += GAME_CONFIG.PHYSICS.GRAVITY * multiplier;
        }
        player.x += player.vx * multiplier;
        player.y += player.vy * multiplier;
        if (player.y >= GAME_CONFIG.PHYSICS.GROUND_Y) {
            player.y = GAME_CONFIG.PHYSICS.GROUND_Y;
            player.vy = 0; player.vx = 0; player.onGround = true;
        }
    }
    
    if (!isInfinite && balls.length > 0) {
        let b = balls[0];
        if ((b.x > 960 + 50 || b.x < -50) || (Math.abs(b.vy) < 0.5 && Math.abs(b.vx) < 0.2 && b.y > GAME_CONFIG.PHYSICS.GROUND_Y - b.r - 5)) {
            if (gameState !== STATE.RESET && !b.held) {
                if (!b.scored && !b.hasHitSomething) handleAirball();
                else if (!b.scored) {
                    currP.streak = 0;
                    gameEvents.push({ type: 'SHOW_MSG', text: "MISS", color: '#bdc3c7' });
                }
                gameState = STATE.RESET;
                setTimeout(() => resetRound(false), 1000);
            }
        }
    }
}

// --- Setters ---
export function setPlayerX(newX) { player.x = newX; }
export function setGameState(newState) { gameState = newState; }
export function setSelectedChar(char) { selectedChar = char; }
export function setHeldBallPosition() {
    if (heldBallIndex !== -1) {
        let b = balls[heldBallIndex];
        b.x = player.x + 14;
        b.y = player.y - 35;
        b.isThree = player.x < GAME_CONFIG.COURT.THREE_POINT_X;
    }
}
