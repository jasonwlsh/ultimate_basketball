
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, setDoc, doc, getDoc, serverTimestamp, query, where, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CENTRALIZED GAME CONFIGURATION ---
const GAME_CONFIG = {
    PHYSICS: {
        GRAVITY: 0.6,
        AIR_FRICTION: 0.99,
        BALL_BOUNCE: 0.6, 
        RIM_BOUNCE: 0.55,
        WALL_BOUNCE_INFINITE: 0.1,
        GROUND_Y: 520
    },
    COURT: {
        THREE_POINT_X: 400,
        HOOP_X: 800,
        HOOP_Y: 240,
        HOOP_W: 70
    },
    METER: {
        SPEED: 0.030, // Faster speed for challenge
        GREEN_WIDTH: 0.15, 
        GREEN_TOLERANCE: 0.05
    },
    GAME: {
        TOTAL_BALLS_CLASSIC: 6,
        INFINITE_TIME: 60,
        PIPE_BALL_SPEED: 8,
        HOT_ZONE_DURATION: 10.0,
        HOT_ZONE_RESPAWN_DELAY: 1.0,
        MAX_BALLS_ON_COURT: 6
    },
    CHARACTERS: {
        curry: { name: 'CURRY', skin: '#f1c27d', jersey: '#fff', speed: 7, zone: '3PT' },
        lbj: { name: 'LBJ', skin: '#5d4037', jersey: '#f1c40f', speed: 4.5, zone: 'MID' }
    },
    PIXEL_SIZE: 4
};

function pixelRect(c,x,y,w,h,col){let _c,_x,_y,_w,_h,_col;if(c instanceof CanvasRenderingContext2D||(c.canvas&&c.fillStyle!==undefined)){_c=c;_x=x;_y=y;_w=w;_h=h;_col=col;}else{_c=ctx;_x=c;_y=x;_w=y;_h=w;_col=h;}if(!_c)return;_c.fillStyle=_col;_c.fillRect(Math.floor(_x/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.floor(_y/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(_w/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(_h/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE);}
function pixelCircle(c,cx,cy,r,col){let _c,_cx,_cy,_r,_col;if(c instanceof CanvasRenderingContext2D||(c.canvas&&c.fillStyle!==undefined)){_c=c;_cx=cx;_cy=cy;_r=r;_col=col;}else{_c=ctx;_cx=c;_cy=cx;_r=cy;_col=r;}if(!_c)return;_c.fillStyle=_col;let step=GAME_CONFIG.PIXEL_SIZE;for(let y=-_r;y<=_r;y+=step){for(let x=-_r;x<=_r;x+=step){if(x*x+y*y<=_r*_r){_c.fillRect(Math.floor((_cx+x)/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.floor((_cy+y)/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,step,step);}}}}

let firebaseConfig,appId;
if(typeof __firebase_config!=='undefined'&&__firebase_config){firebaseConfig=JSON.parse(__firebase_config);appId=typeof __app_id!=='undefined'?__app_id:firebaseConfig.projectId;}else{firebaseConfig={apiKey:"AIzaSyDizpxgLQfGMVFRfakfs1MwuhF4k4ZRLP4",authDomain:"streetball-ultimate-rank.firebaseapp.com",projectId:"streetball-ultimate-rank",storageBucket:"streetball-ultimate-rank.firebasestorage.app",messagingSenderId:"1081286196484",appId:"1:1081286196484:web:0677e0eab585c583faa451",measurementId:"G-ZP9H5GTLNV"};appId=firebaseConfig.projectId;}
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
let currentUser=null,currentPlayerName="";

async function initAuth(){try{if(typeof __initial_auth_token!=='undefined'&&__initial_auth_token){await signInWithCustomToken(auth,__initial_auth_token);}else{await signInAnonymously(auth);}currentUser=auth.currentUser;fetchLeaderboardDisplay();loadProfileFromCloud();}catch(e){console.error("Auth failed.",e);}}
initAuth();
async function logScoreHistory(name,score){if(!currentUser||score<=0)return;try{await addDoc(collection(db,'artifacts',appId,'public','data','score_history'),{name:name,score:score,uid:currentUser.uid,date:serverTimestamp()});}catch(e){console.error(e);}}

const historyModal=document.getElementById('history-modal'),historyContentEl=document.getElementById('history-content-el'),btnViewHistory=document.getElementById('btn-view-history'),btnCloseHistory=document.getElementById('btn-close-history');
btnViewHistory.onclick=()=>fetchScoreHistory();btnCloseHistory.onclick=()=>historyModal.classList.add('hidden');
async function fetchScoreHistory(){if(!currentUser)return;historyContentEl.innerHTML='<div class="history-loading">LOADING HISTORY...</div>';settingsModal.classList.add('hidden');historyModal.classList.remove('hidden');try{const q=query(collection(db,'artifacts',appId,'public','data','score_history'),orderBy('date','desc'),limit(10));const snapshot=await getDocs(q);if(snapshot.empty){historyContentEl.innerHTML='<div class="history-loading">NO HISTORY YET. START SHOOTING!</div>';return;}let html='<table class="history-table"><thead><tr><td class="hist-time">TIME</td><td class="hist-name">NAME</td><td class="hist-score">SCORE</td></tr></thead><tbody>';snapshot.forEach(doc=>{const d=doc.data();html+=`<tr><td class="hist-time">${d.date?.toDate()?d.date.toDate().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}):'N/A'}</td><td class="hist-name">${escapeHtml(d.name)}</td><td class="hist-score">${d.score}</td></tr>`;});html+='</tbody></table>';historyContentEl.innerHTML=html;}catch(e){historyContentEl.innerHTML='<div class="history-loading">ERROR</div>';}}

const rankResultBox=document.getElementById('rank-result-box'),rankStatusText=document.getElementById('rank-status-text'),rankValText=document.getElementById('rank-val-text'),rankPercentileText=document.getElementById('rank-percentile-text'),startLbContent=document.getElementById('start-lb-content'),skinUnlockMsg=document.getElementById('skin-unlock-msg');
async function fetchLeaderboardDisplay(){if(!currentUser)return;startLbContent.innerHTML='<div class="slb-loading">LOADING RANKS...</div>';try{const s=await getDocs(collection(db,'artifacts',appId,'public','data','leaderboard'));let sc=processScores(s),usc=removeScoreDuplicates(sc).slice(0,5);if(usc.length===0){startLbContent.innerHTML='<div class="slb-loading">NO RECORDS YET.</div>';return;}let h='<table class="start-lb-table">';usc.forEach((x,i)=>{let c=i===0?'#ffd700':(i===1?'#c0c0c0':(i===2?'#cd7f32':'#777'));h+=`<tr><td class="slb-rank" style="color:${c}">${i+1}.</td><td class="slb-name">${escapeHtml(x.name)}</td><td class="slb-score">${x.score}</td></tr>`;});h+='</table>';startLbContent.innerHTML=h;}catch(e){startLbContent.innerHTML='<div class="slb-loading">ERROR</div>';}}
function processScores(s){let r=[];s.forEach(d=>{let dt=d.data();if(dt.score!==undefined&&dt.name)r.push({...dt,id:d.id});});r.sort((a,b)=>b.score-a.score);return r;}
function removeScoreDuplicates(a){const u={};a.forEach(s=>{if(!u[s.uid]||s.score>u[s.uid].score)u[s.uid]=s;});return Object.values(u).sort((a,b)=>b.score-a.score);}
async function handleAutoUpload(name,score){if(!currentUser)return;rankResultBox.classList.add('show');rankStatusText.innerText="CHECKING GLOBAL RANK...";rankValText.innerHTML='<span class="rank-loading">...</span>';rankPercentileText.innerText="";skinUnlockMsg.classList.add('hidden');try{if(score>0)await logScoreHistory(name,score);const col=collection(db,'artifacts',appId,'public','data','leaderboard');const usnap=await getDocs(query(col,where("uid","==",currentUser.uid)));let usc=[];usnap.forEach(d=>usc.push({score:d.data().score,id:d.id}));let curBest=usc.reduce((m,s)=>Math.max(m,s.score),0);if(score>curBest){await Promise.all(usc.map(s=>deleteDoc(doc(db,'artifacts',appId,'public','data','leaderboard',s.id))));await addDoc(col,{name:name,score:score,uid:currentUser.uid,date:serverTimestamp()});const allS=processScores(await getDocs(col)),uniq=removeScoreDuplicates(allS);let rank=uniq.findIndex(s=>s.uid===currentUser.uid)+1,tot=uniq.length,low=uniq.filter(s=>score>s.score).length,pct=tot>0?Math.round((low/tot)*100):0;if(tot===1)pct=100;rankStatusText.innerText="NEW RECORD!";rankStatusText.style.color="#ffd700";rankValText.innerHTML=`GLOBAL RANK #${rank}`;rankValText.style.color="#00e676";rankPercentileText.innerText=`BETTER THAN ${pct}% OF USERS`;if(rank<=5&&!isGoldUnlocked){isGoldUnlocked=true;skinUnlockMsg.classList.remove('hidden');saveProfileToCloud();}}else{rankStatusText.innerText="SCORE LOGGED";rankStatusText.style.color="#bdc3c7";rankValText.innerHTML=`BEST: ${curBest}`;rankValText.style.color="#7f8c8d";}fetchLeaderboardDisplay();}catch(e){rankStatusText.innerText="CONNECTION ERROR";rankValText.innerText="OFFLINE";}}
async function loadProfileFromCloud(){if(!currentUser)return;try{const d=await getDoc(doc(db,'artifacts',appId,'users',currentUser.uid,'settings','profile'));if(d.exists()){const dt=d.data();if(dt.highScore>localHighScore){localHighScore=dt.highScore;updateLocalHighScoreDisplay();}if(dt.skinGold)isGoldUnlocked=true;if(dt.playerName)inputName.value=dt.playerName;localStorage.setItem('bs_highscore',localHighScore);localStorage.setItem('bs_skin_gold',isGoldUnlocked);}}catch(e){}}
async function saveProfileToCloud(){if(!currentUser)return;try{await setDoc(doc(db,'artifacts',appId,'users',currentUser.uid,'settings','profile'),{highScore:localHighScore,skinGold:isGoldUnlocked,playerName:currentPlayerName,lastUpdated:serverTimestamp()});}catch(e){}}
function escapeHtml(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";}

const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
const uiLayer=document.getElementById('game-ui'),startScreen=document.getElementById('start-screen'),charSelectScreen=document.getElementById('char-select-screen'),gameOverScreen=document.getElementById('game-over'),turnMsg=document.getElementById('turn-msg'),tutorialMsg=document.getElementById('tutorial-msg'),countdownWarning=document.getElementById('countdown-warning');
const p1Panel=document.getElementById('p1-panel'),p2Panel=document.getElementById('p2-panel'),scoreP1El=document.getElementById('score-p1'),scoreP2El=document.getElementById('score-p2'),ballEl=document.getElementById('ballVal'),ballLabelP1=document.getElementById('ballLabelP1'),ballElP2=document.getElementById('ballValP2');
const fireVal=document.getElementById('fireVal'),rainbowVal=document.getElementById('rainbowVal'),x2Val=document.getElementById('x2Val'),msgEl=document.getElementById('msg'),menuBestEl=document.getElementById('menu-best'),newRecordMsg=document.getElementById('new-record-msg'),inputName=document.getElementById('input-name');
const btn1P=document.getElementById('btn-1p'),btnInf=document.getElementById('btn-inf'),btn2P=document.getElementById('btn-2p'),btnConfirmChar=document.getElementById('btn-confirm-char'),btnRestart=document.getElementById('btn-restart'),btnExitGame=document.getElementById('btn-exit-game');
const btnOpenSettings=document.getElementById('btn-open-settings'),btnCloseSettings=document.getElementById('btn-close-settings'),settingsModal=document.getElementById('settings-modal'),inputRotate=document.getElementById('set-rotate'),inputBounce=document.getElementById('set-bounce'),valBounce=document.getElementById('val-bounce'),btnColPrev=document.getElementById('btn-col-prev'),btnColNext=document.getElementById('btn-col-next'),colPreview=document.getElementById('col-preview'),lockOverlay=document.getElementById('lock-overlay'),lockMsg=document.getElementById('lock-msg'),btnUploadBg=document.getElementById('btn-upload-bg'),bgUploadInput=document.getElementById('bg-upload');
const cardX2=document.getElementById('card-x2'),cardBig=document.getElementById('card-big'),countX2El=document.getElementById('count-x2'),countBigEl=document.getElementById('count-big'),posUI=document.getElementById('pos-ui'),btnLockPos=document.getElementById('btn-lock-pos'),gameWrapper=document.getElementById('game-wrapper'),gameContainer=document.getElementById('game-container');
ctx.imageSmoothingEnabled=false;

let localHighScore=parseInt(localStorage.getItem('bs_highscore'))||0,isGoldUnlocked=localStorage.getItem('bs_skin_gold')==='true',savedName=localStorage.getItem('bs_playername');
if(savedName)inputName.value=savedName;
function updateLocalHighScoreDisplay(){menuBestEl.innerText=localHighScore;}
updateLocalHighScoreDisplay();

let isRotated=false;
function resize(){const w=window.innerWidth,h=window.innerHeight;let tw=960,th=600,s;if(isRotated){s=Math.min(h/tw,w/th)*0.95;gameWrapper.style.transform=`rotate(90deg) scale(${s})`;}else{s=(h>w)?(w/tw)*0.95:Math.min(w/tw,h/th)*0.95;gameWrapper.style.transform=`rotate(0deg) scale(${s})`;}}
window.addEventListener('resize',resize);

let ballColors=['#e67e22','#00e676','#3498db','#9b59b6','#e91e63','#ffd700'],ballColorIdx=0,p1Color=ballColors[0],customBgImage=null;
function updateColorUI(){const c=ballColors[ballColorIdx];colPreview.style.backgroundColor=c;if(c==='#ffd700'&&!isGoldUnlocked){lockOverlay.classList.remove('hidden');lockMsg.innerText="REACH TOP 5";}else{lockOverlay.classList.add('hidden');lockMsg.innerText="";}}
btnColPrev.onclick=()=>{ballColorIdx=(ballColorIdx-1+ballColors.length)%ballColors.length;updateColorUI();};btnColNext.onclick=()=>{ballColorIdx=(ballColorIdx+1)%ballColors.length;updateColorUI();};
btnOpenSettings.onclick=()=>{settingsModal.classList.remove('hidden');updateColorUI();};btnCloseSettings.onclick=()=>{settingsModal.classList.add('hidden');applySettings();};
btnUploadBg.onclick=()=>bgUploadInput.click();
bgUploadInput.onchange=(e)=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=(ev)=>{const i=new Image();i.onload=()=>{customBgImage=i;btnUploadBg.innerText="BG SET! ✅";};i.src=ev.target.result;};r.readAsDataURL(f);}};
inputBounce.oninput=()=>valBounce.innerText=(inputBounce.value/10).toFixed(1);
function applySettings(){GAME_CONFIG.PHYSICS.BALL_BOUNCE=inputBounce.value/10;const s=ballColors[ballColorIdx];if(s==='#ffd700'&&!isGoldUnlocked){p1Color=ballColors[0];ballColorIdx=0;}else{p1Color=s;}let nr=inputRotate.checked;if(nr!==isRotated){isRotated=nr;resize();}}

const STATE={POS:0,AIMING:1,FLYING:2,RESET:3,OVER:4,MENU:5,PICKUP:6,CHAR_SELECT:7};
let gameState=STATE.MENU,numPlayers=1,turnPlayer=1,isInfinite=false,infiniteTimer=60;
const defaultPlayerData=()=>({score:0,balls:GAME_CONFIG.GAME.TOTAL_BALLS_CLASSIC,streak:0,isFireball:false,hasRainbow:false,usingRainbow:false,pu_x2:{count:2,active:false},pu_big:{count:2,active:false},shotsCount:0});
let p1=defaultPlayerData(),p2=defaultPlayerData(),currP=p1;
let selectedChar='curry';
window.selectChar=(c)=>{selectedChar=c;document.querySelectorAll('.char-card').forEach(e=>e.classList.remove('selected'));document.getElementById('char-'+c).classList.add('selected');};

let player={x:100,y:GAME_CONFIG.PHYSICS.GROUND_Y,vx:0,vy:0,onGround:true};
let aimOscillator=0,aimDirection=1;
let HOOP={x:GAME_CONFIG.COURT.HOOP_X,y:GAME_CONFIG.COURT.HOOP_Y,w:GAME_CONFIG.COURT.HOOP_W,rimR:4,backX:880,backW:10,backH:110};

// --- POOL SYSTEM ---
let balls=[]; 
let heldBallIndex = -1; 

let floatingItem={active:false,x:0,y:0,type:'rainbow',offset:0,dir:1,scale:0,spawning:false};
let neonZone={active:false,x:0,w:100,timer:0,cooldown:0};
let particles=[],floatScores=[],hue=0;
let pendingMode={players:1,infinite:false};

btn1P.onclick=()=>{setPlayerName();pendingMode={players:1,infinite:false};showCharSelect();};
btnInf.onclick=()=>{setPlayerName();pendingMode={players:1,infinite:true};showCharSelect();};
btn2P.onclick=()=>{pendingMode={players:2,infinite:false};showCharSelect();};
btnConfirmChar.onclick=()=>{startGame(pendingMode.players,pendingMode.infinite);};
function showCharSelect(){startScreen.classList.add('hidden');charSelectScreen.classList.remove('hidden');gameState=STATE.CHAR_SELECT;renderCharPreview('preview-curry','curry');renderCharPreview('preview-lbj','lbj');}
function renderCharPreview(cid,ck){const c=document.getElementById(cid);if(!c)return;const cx=c.getContext('2d');cx.clearRect(0,0,c.width,c.height);cx.save();drawPixelCharacter(cx,50,110,ck,false);cx.restore();}
function setPlayerName(){let n=inputName.value.trim().toUpperCase();if(n){localStorage.setItem('bs_playername',n);currentPlayerName=n;}}
btnRestart.onclick=()=>showStartScreen();
btnExitGame.onclick=(e)=>{e.stopPropagation();showStartScreen();};
cardX2.onclick=(e)=>{e.stopPropagation();usePowerup('x2');};cardBig.onclick=(e)=>{e.stopPropagation();usePowerup('big');};
let moveLeft=false,moveRight=false,isDragging=false;
function confirmPosition(){if(gameState===STATE.POS && heldBallIndex !== -1){gameState=STATE.AIMING;aimOscillator=0;aimDirection=1;posUI.classList.add('hidden');tutorialMsg.classList.add('hidden');}}
btnLockPos.onclick=(e)=>{e.stopPropagation();confirmPosition();};
window.addEventListener('pointerdown',(e)=>{if(!settingsModal.classList.contains('hidden')||!historyModal.classList.contains('hidden'))return;if(e.target.closest('.settings-btn')||e.target.closest('.rank-btn')||e.target.closest('.pos-lock-btn')||e.target.closest('.char-card')||e.target.closest('#btn-confirm-char'))return;if(gameState===STATE.POS||gameState===STATE.PICKUP)isDragging=true;else if(gameState===STATE.AIMING)handleGameInput();});
window.addEventListener('pointermove',(e)=>{if(isDragging&&(gameState===STATE.POS||gameState===STATE.PICKUP)){let rect=gameWrapper.getBoundingClientRect(),scaleX=960/rect.width,inputX=(e.clientX-rect.left)*scaleX,maxL=50,maxR=isInfinite?canvas.width-50:GAME_CONFIG.COURT.THREE_POINT_X+200;player.x=Math.max(maxL,Math.min(maxR,inputX));}});
window.addEventListener('pointerup',()=>isDragging=false);
window.addEventListener('keydown',(e)=>{if(e.code==='Space'){if(gameState===STATE.POS && heldBallIndex !== -1)confirmPosition();else if(gameState===STATE.AIMING)handleGameInput();}if(e.code==='ArrowLeft')moveLeft=true;if(e.code==='ArrowRight')moveRight=true;});
window.addEventListener('keyup',(e)=>{if(e.code==='ArrowLeft')moveLeft=false;if(e.code==='ArrowRight')moveRight=false;});
function handleGameInput(){if(gameState===STATE.AIMING)launchBall();}

function showStartScreen(){updateLocalHighScoreDisplay();gameOverScreen.classList.add('hidden');charSelectScreen.classList.add('hidden');startScreen.classList.remove('hidden');uiLayer.style.display='none';gameState=STATE.MENU;btnOpenSettings.style.display='flex';if(currentUser)fetchLeaderboardDisplay();}
function startGame(p,inf){
    numPlayers=p;turnPlayer=1;isInfinite=inf;infiniteTimer=GAME_CONFIG.GAME.INFINITE_TIME;
    p1=defaultPlayerData();p2=defaultPlayerData();
    charSelectScreen.classList.add('hidden');startScreen.classList.add('hidden');gameOverScreen.classList.add('hidden');uiLayer.style.display='block';btnOpenSettings.style.display='none';
    if(numPlayers===2){p2Panel.style.display='flex';document.getElementById('ballDisplayP2').classList.remove('hidden');document.getElementById('p2-end-score').style.display='block';}else{p2Panel.style.display='none';document.getElementById('ballDisplayP2').classList.add('hidden');document.getElementById('p2-end-score').style.display='none';}
    if(isInfinite){document.getElementById('ballDisplay').classList.remove('hidden');ballLabelP1.innerText="TIME";document.getElementById('ballVal').classList.add('large-timer');showTurnMessage("INFINITE MODE!","#f1c40f");document.querySelector('.powerup-bar').style.display='none';neonZone.active=false;neonZone.cooldown=0;spawnNeonZone();}else{document.getElementById('ballDisplay').classList.remove('hidden');ballLabelP1.innerText="P1 BALLS";document.getElementById('ballVal').classList.remove('large-timer');document.querySelector('.powerup-bar').style.display='flex';}
    startTurn();
}
function startTurn(){currP=(turnPlayer===1)?p1:p2;if(currP.hasRainbow){currP.usingRainbow=true;currP.hasRainbow=false;}else{currP.usingRainbow=false;}updateTopBarUI();updatePowerupUI();resetRound(true);if(numPlayers===2)showTurnMessage(`P${turnPlayer} START!`,turnPlayer===1?'#f1c40f':'#00ffff');}

function spawnBall(x,y,vx,vy){
    return {x:x, y:y, r:16, vx:vx, vy:vy, scored:false, isThree:false, hasHitSomething:false, hasHitRim:false, hasHitBoard:false, minDistToHoop:9999, held:false, isZoneShot:false, isGreen:false, active:true, scoreTimer:0, pickupTimer:0};
}

// --- DYNAMIC GREEN ZONE ---
function getGreenZoneStart(){
    // Calculates green zone based on distance to hoop
    // 0px -> 0.55
    // 800px -> 0.90
    let dist = Math.abs(HOOP.x - player.x);
    let normalized = Math.min(dist, 700) / 700; // 0 to 1
    return 0.7 - (normalized * 0.22);
}

function calculateLaunchVelocity(ov, ballIdx){
    let b = balls[ballIdx];
    let distToHoop = HOOP.x - b.x;
    let powerMult = 0.2 + (ov * 1.0); 
    let baseVx = distToHoop * 0.030; 
    return { vx: baseVx * powerMult, vy: -15 - (powerMult * 12) };
}

function launchBall(){
    if(heldBallIndex === -1) return;
    document.getElementById('tutorial-msg').classList.add('hidden');
    gameState=STATE.FLYING;
    posUI.classList.add('hidden'); 
    
    if(!isInfinite)currP.balls--;
    updateTopBarUI();
    currP.shotsCount++;
    consumePowerups();
    
    let b = balls[heldBallIndex];
    let vel = calculateLaunchVelocity(aimOscillator, heldBallIndex);
    b.vx = vel.vx;
    b.vy = vel.vy;
    b.isGreen = false;
    b.pickupTimer = 0.5; // 0.5s cooldown before pickup
    
    // Check against Dynamic Green Zone
    let greenStart = getGreenZoneStart();
    if(Math.abs(aimOscillator - greenStart) < GAME_CONFIG.METER.GREEN_TOLERANCE) {
        showMsg("PERFECT RELEASE", "#00e676"); 
        b.isGreen = true;
        let dist = HOOP.x + HOOP.w/2 - b.x;
        let perfectVx = dist * 0.0285; 
        b.vx = perfectVx;
        b.vy = -15 - (0.95 * 12); 
    }

    b.held = false;
    heldBallIndex = -1; 
    
    b.isZoneShot = false;
    if(isInfinite&&neonZone.active){if(player.x>neonZone.x-20&&player.x<neonZone.x+neonZone.w+20)b.isZoneShot=true;}
    player.vy=-12;player.vx=-3;player.onGround=false;
}

function resetRound(isNew=false){
    if(!isInfinite){
        if(p1.balls<=0&&(numPlayers===1||p2.balls<=0)){endGame();return;}
        if(!isNew&&numPlayers===2){
            if((turnPlayer===1&&p2.balls>0)||(turnPlayer===1&&p1.balls<=0)){turnPlayer=2;setTimeout(startTurn,100);return;}
            else if((turnPlayer===2&&p1.balls>0)||(turnPlayer===2&&p2.balls<=0)){turnPlayer=1;setTimeout(startTurn,100);return;}
        }
    } else {
        if(infiniteTimer<=0){endGame();return;}
    }
    if(numPlayers===1&&!isNew){if(currP.hasRainbow){currP.usingRainbow=true;currP.hasRainbow=false;}else currP.usingRainbow=false;updateTopBarUI();}
    resetPowerupsForRound();
    
    balls = [];
    heldBallIndex = -1;

    if(isInfinite){
        // Init Pool: 5 balls
        balls.push(spawnBall(40, 240, GAME_CONFIG.GAME.PIPE_BALL_SPEED, -2));
        gameState=STATE.PICKUP;
        tutorialMsg.innerText="GET THE BALL!";tutorialMsg.classList.remove('hidden');
    }else{
        player.x=100+Math.random()*100;
        player.y=GAME_CONFIG.PHYSICS.GROUND_Y;
        player.vx=0;player.vy=0;player.onGround=true;
        let b = spawnBall(player.x+14, player.y-35, 0, 0);
        b.held = true;
        b.isThree = player.x < GAME_CONFIG.COURT.THREE_POINT_X;
        balls.push(b);
        heldBallIndex = 0;
        gameState=STATE.POS;
        posUI.classList.remove('hidden');
        tutorialMsg.innerText="DRAG OR USE ARROWS TO MOVE";tutorialMsg.classList.remove('hidden');
    }
    particles=[];
    if(!isInfinite){
        if(currP.shotsCount===1)spawnFloatingItem('rainbow');else if(currP.shotsCount===5)spawnFloatingItem('ball');else floatingItem.active=false;
    }else floatingItem.active=false;
    updateTopBarUI();
}

function recycleBall(b) {
    // Reset ball to pipe launch
    b.x = 40; b.y = 240; 
    b.vx = GAME_CONFIG.GAME.PIPE_BALL_SPEED; b.vy = -2;
    b.scored = false; b.held = false; b.scoreTimer = 0; b.pickupTimer = 0;
    b.hasHitSomething = false; b.hasHitBoard = false; b.hasHitRim = false;
    b.isGreen = false;
}

function spawnNeonZone(){neonZone.active=true;let isThree=(selectedChar==='curry')?Math.random()<0.8:Math.random()<0.2;if(isThree)neonZone.x=50+Math.random()*(GAME_CONFIG.COURT.THREE_POINT_X-150);else neonZone.x=GAME_CONFIG.COURT.THREE_POINT_X+50+Math.random()*150;neonZone.w=80;neonZone.timer=GAME_CONFIG.GAME.HOT_ZONE_DURATION;}
function spawnFloatingItem(t){floatingItem.active=true;floatingItem.spawning=true;floatingItem.scale=0;let minX=150,maxX=HOOP.backX-50;floatingItem.x=minX+Math.random()*(maxX-minX);floatingItem.y=100+Math.random()*150;floatingItem.type=t;spawnFloatScore(0,floatingItem.x,floatingItem.y,t==='rainbow'?"ITEM!":"+1 BALL");}
function usePowerup(t){if(gameState!==STATE.AIMING&&gameState!==STATE.POS)return;let pk='pu_'+t,pu=currP[pk];if(pu.count>0){if(!pu.active){currP.pu_x2.active=false;currP.pu_big.active=false;pu.active=true;}else pu.active=false;updatePowerupUI();applyHoopSize();updateTopBarUI();}}
function applyHoopSize(){if(currP.pu_big.active){HOOP.w=110;HOOP.x=GAME_CONFIG.COURT.HOOP_X-40;}else{HOOP.w=GAME_CONFIG.COURT.HOOP_W;HOOP.x=GAME_CONFIG.COURT.HOOP_X;}}
function updatePowerupUI(){updateCardStyle(cardX2,currP.pu_x2,countX2El);updateCardStyle(cardBig,currP.pu_big,countBigEl);}
function updateCardStyle(e,d,c){if(d.active)e.classList.add('active');else e.classList.remove('active');if(d.count<=0)e.classList.add('disabled');else e.classList.remove('disabled');c.innerText="x"+d.count;}
function consumePowerups(){if(currP.pu_x2.active){currP.pu_x2.count--;x2Val.classList.remove('show');}if(currP.pu_big.active)currP.pu_big.count--;updatePowerupUI();}
function resetPowerupsForRound(){currP.pu_x2.active=false;currP.pu_big.active=false;x2Val.classList.remove('show');updatePowerupUI();applyHoopSize();}
function updateTopBarUI(){scoreP1El.innerText=p1.score;scoreP2El.innerText=p2.score;if(!isInfinite){ballEl.innerText=p1.balls;ballElP2.innerText=p2.balls;}else ballEl.innerText=Math.ceil(infiniteTimer)+"s";if(turnPlayer===1){p1Panel.classList.add('active');p2Panel.classList.remove('active');}else{p1Panel.classList.remove('active');p2Panel.classList.add('active');}fireVal.classList.remove('show');rainbowVal.classList.remove('show');if(currP.usingRainbow)rainbowVal.classList.add('show');else if(currP.streak>=3){currP.isFireball=true;fireVal.classList.add('show');}else currP.isFireball=false;if(currP.pu_x2.active)x2Val.classList.add('show');const bb=(turnPlayer===1)?document.getElementById('ballDisplay'):document.getElementById('ballDisplayP2');if(bb){bb.classList.remove('pop');void bb.offsetWidth;}}

function endGame(){gameState=STATE.OVER;posUI.classList.add('hidden');countdownWarning.style.display='none';document.getElementById('end-p1').innerText=p1.score;document.getElementById('end-p2').innerText=p2.score;let t="GAME OVER";if(isInfinite)t="TIME'S UP!";newRecordMsg.classList.add('hidden');rankResultBox.classList.remove('show');rankPercentileText.innerText="";if(numPlayers===1){if(p1.score>localHighScore){localHighScore=p1.score;localStorage.setItem('bs_highscore',localHighScore);newRecordMsg.classList.remove('hidden');updateLocalHighScoreDisplay();}if(p1.score>0&&currentUser)handleAutoUpload(currentPlayerName,p1.score);saveProfileToCloud();}else{if(p1.score>p2.score)t="P1 WINS!";else if(p2.score>p1.score)t="P2 WINS!";else t="DRAW GAME";}document.getElementById('go-title').innerText=t;gameOverScreen.classList.remove('hidden');}
function loop(){update();draw();requestAnimationFrame(loop);}
resize();requestAnimationFrame(loop);

function update(){
    hue+=5;if(gameState===STATE.MENU||gameState===STATE.OVER||gameState===STATE.CHAR_SELECT)return;let sm=currP.usingRainbow?1.5:1.0;
    if(isInfinite&&gameState!==STATE.OVER){infiniteTimer-=1/60;if(infiniteTimer<=10&&infiniteTimer>0){countdownWarning.innerText=Math.ceil(infiniteTimer);countdownWarning.style.display='block';if(infiniteTimer<=3)countdownWarning.style.color='#ff0000';}else countdownWarning.style.display='none';if(infiniteTimer<=0){infiniteTimer=0;endGame();}if(Math.floor(infiniteTimer)%1===0&&Math.floor(infiniteTimer)!==Math.floor(infiniteTimer+1/60))updateTopBarUI();if(neonZone.active){neonZone.timer-=1/60;if(neonZone.timer<=0){neonZone.active=false;neonZone.cooldown=GAME_CONFIG.GAME.HOT_ZONE_RESPAWN_DELAY;}}else{if(!neonZone.cooldown)neonZone.cooldown=0;if(neonZone.cooldown>0)neonZone.cooldown-=1/60;else spawnNeonZone();}}
    
    if(gameState===STATE.POS||gameState===STATE.PICKUP||gameState===STATE.FLYING||gameState===STATE.AIMING){ 
        let s=GAME_CONFIG.CHARACTERS[selectedChar].speed;
        if(moveLeft)player.x-=s;if(moveRight)player.x+=s;
        let mr=isInfinite?canvas.width-50:GAME_CONFIG.COURT.THREE_POINT_X+200;if(player.x<50)player.x=50;if(player.x>mr)player.x=mr;
        
        if(heldBallIndex !== -1){
            let b = balls[heldBallIndex];
            b.x=player.x+14; b.y=player.y-35; b.isThree=player.x<GAME_CONFIG.COURT.THREE_POINT_X;
        } else {
            // AUTO PICKUP LOGIC
            let closestDist = 9999;
            let closestIdx = -1;
            
            balls.forEach((b, idx) => {
                if(!b.held && b.scoreTimer <= 0 && b.pickupTimer <= 0){ // CHECK COOLDOWN
                    let d = Math.abs(player.x - b.x);
                    let h = player.y - b.y;
                    if(d < 60 && h < 150 && h > -50){
                        if(d < closestDist){
                            closestDist = d;
                            closestIdx = idx;
                        }
                    }
                }
            });
            
            if(closestIdx !== -1){
                heldBallIndex = closestIdx;
                let b = balls[closestIdx];
                b.held = true;
                b.scored = false; // Reset scored status on pickup
                b.scoreTimer = 0;
                b.vx = 0; b.vy = 0; 
                gameState=STATE.POS; 
                posUI.classList.remove('hidden'); 
                tutorialMsg.innerText="POSITION & SHOOT";
            }
        }
    }
    
    // POOL CHECK: Ensure enough balls
    if(isInfinite && balls.length < 5 && balls.filter(b=>!b.scored).length < 2) {
        balls.push(spawnBall(40, 240, GAME_CONFIG.GAME.PIPE_BALL_SPEED, -2));
    }

    // PHYSICS & POOL MANAGEMENT
    balls.forEach(b => {
        // Timers
        if(b.scoreTimer > 0){
            b.scoreTimer -= 1/60;
            if(b.scoreTimer <= 0 && isInfinite) recycleBall(b); 
        }
        if(b.pickupTimer > 0) b.pickupTimer -= 1/60;

        if(!b.held){
            b.vy+=GAME_CONFIG.PHYSICS.GRAVITY; b.x+=b.vx; b.y+=b.vy;
            if(isInfinite){
                if(b.x<16){b.x=16;b.vx*=-GAME_CONFIG.PHYSICS.WALL_BOUNCE_INFINITE;}
                if(b.x>canvas.width-16){b.x=canvas.width-16;b.vx*=-GAME_CONFIG.PHYSICS.WALL_BOUNCE_INFINITE;}
            }
            b.vx*=GAME_CONFIG.PHYSICS.AIR_FRICTION; b.vy*=GAME_CONFIG.PHYSICS.AIR_FRICTION;
            
            const hcx=HOOP.x+HOOP.w/2,hcy=HOOP.y;
            const d=Math.hypot(b.x-hcx,b.y-hcy);
            if(d<b.minDistToHoop)b.minDistToHoop=d;
            
            if(b.y+b.r>GAME_CONFIG.PHYSICS.GROUND_Y){
                b.y=GAME_CONFIG.PHYSICS.GROUND_Y-b.r; b.vy*=-GAME_CONFIG.PHYSICS.BALL_BOUNCE; b.vx*=0.9;
                if(!b.scored && !b.hasHitSomething && Math.abs(b.vy)<1){
                    if(!isInfinite) handleAirball(); 
                    b.hasHitSomething=true;
                }
            }
            checkCollisions(b);
            
            if(floatingItem.active){
                const idx = b.x-floatingItem.x, idy=b.y-(floatingItem.y+floatingItem.offset);
                if(Math.sqrt(idx*idx+idy*idy) < b.r+25) checkItemCollision();
            }
            
            if(b.vx !== 0 || b.vy !== 0){
               if(currP.usingRainbow)spawnParticles(b.x,b.y,3,[`hsl(${hue}, 70%, 60%)`]);
               else if(currP.isFireball)spawnParticles(b.x,b.y,2,['#ff5722','#f1c40f']);
            }
        }
    });
    
    if(gameState===STATE.AIMING){
        aimOscillator+=GAME_CONFIG.METER.SPEED*aimDirection*sm; 
        if(aimOscillator>=1||aimOscillator<=0)aimDirection*=-1;
    }
    
    if(floatingItem.active){floatingItem.offset+=floatingItem.dir*0.5;if(Math.abs(floatingItem.offset)>8)floatingItem.dir*=-1;if(floatingItem.spawning){floatingItem.scale+=0.1;if(floatingItem.scale>=1.2){floatingItem.scale=1;floatingItem.spawning=false;}}}
    
    if(!player.onGround){player.vy+=GAME_CONFIG.PHYSICS.GRAVITY;player.x+=player.vx;player.y+=player.vy;if(player.y>=GAME_CONFIG.PHYSICS.GROUND_Y){player.y=GAME_CONFIG.PHYSICS.GROUND_Y;player.vy=0;player.vx=0;player.onGround=true;}}
    
    if(!isInfinite && balls.length > 0){
        let b = balls[0];
        if((b.x>canvas.width+50||b.x<-50)||(Math.abs(b.vy)<0.5&&Math.abs(b.vx)<0.2&&b.y>GAME_CONFIG.PHYSICS.GROUND_Y-b.r-5)){
            if(gameState!==STATE.RESET && !b.held){
                if(!b.scored&&!b.hasHitSomething)handleAirball();
                else if(!b.scored){if(currP.isRainbow)currP.isRainbow=false;currP.streak=0;updateTopBarUI();showMsg("MISS",'#bdc3c7');}
                gameState=STATE.RESET;if(currP.isRainbow)currP.isRainbow=false;setTimeout(()=>resetRound(false),1000);
            }
        }
    }
    updateParticles();updateFloatScores();
}

function checkCollisions(b){
    if(b.x+b.r>HOOP.backX&&b.x-b.r<HOOP.backX+HOOP.backW&&b.y>HOOP.y-80&&b.y<HOOP.y+50){if(b.vx>0){b.x=HOOP.backX-b.r;b.vx*=-GAME_CONFIG.PHYSICS.BALL_BOUNCE*1.1;b.vy*=0.9;b.hasHitSomething=true;b.hasHitBoard=true;showMsg("CLANK!",'#cfd8dc');}}
    if(!b.isGreen) checkRimHit(b, {x:HOOP.x,y:HOOP.y});
    checkRimHit(b, {x:HOOP.x+HOOP.w,y:HOOP.y}); 
    if(!b.scored&&b.vy>0){if(b.x>HOOP.x+b.r/2&&b.x<HOOP.x+HOOP.w-b.r/2){if(b.y>=HOOP.y&&b.y<=HOOP.y+20)handleScore(b);}}
}
function checkRimHit(b, r){const dx=b.x-r.x,dy=b.y-r.y,dist=Math.sqrt(dx*dx+dy*dy);if(dist<b.r+HOOP.rimR){b.hasHitSomething=true;b.hasHitRim=true;const nx=dx/dist,ny=dy/dist,dot=b.vx*nx+b.vy*ny;b.vx=(b.vx-2*dot*nx)*GAME_CONFIG.PHYSICS.RIM_BOUNCE;b.vy=(b.vy-2*dot*ny)*GAME_CONFIG.PHYSICS.RIM_BOUNCE;const o=(b.r+HOOP.rimR)-dist;b.x+=nx*o;b.y+=ny*o;}}
function checkItemCollision(){floatingItem.active=false;let t=floatingItem.type,txt="";if(t==='ball'){currP.balls++;updateTopBarUI();txt="+1 BALL";}else if(t==='rainbow'){currP.hasRainbow=true;txt="RAINBOW NEXT!";}spawnFloatScore(0,floatingItem.x,floatingItem.y,txt);spawnParticles(floatingItem.x,floatingItem.y,15,['#00e676','#fff']);}

function handleScore(b){
    b.scored=true; b.scoreTimer = 3.0; // Set 3s recycle timer
    currP.streak++;let pts=b.isThree?3:2,mult=1;if(currP.isFireball)mult*=2;if(currP.usingRainbow)mult*=3;if(currP.pu_x2.active)mult*=2;let z=false;if(b.isZoneShot){mult*=2;z=true;}pts*=mult;let sb=0,ic=Math.abs(b.x-(HOOP.x+HOOP.w/2))<10;if(ic&&!b.hasHitBoard&&!b.hasHitRim)sb=1;pts+=sb;currP.score+=pts;let m=sb?"SWISH! +1":"GOOD!",c=sb?"#00e676":"#fff";if(b.isThree){m=sb?"3PT SWISH!":"3 POINTER!";c="#f1c40f";};if(currP.isFireball){m="FIRE!";c="#e74c3c";}if(currP.usingRainbow){m="RAINBOW!!!";c=`hsl(${hue}, 70%, 60%)`;}if(z){m+=" ZONE X2!";c="#e056fd";}showMsg(m,c);if(currP.isFireball||currP.usingRainbow||z){gameContainer.classList.add('shake');setTimeout(()=>gameContainer.classList.remove('shake'),500);}spawnFloatScore(pts,HOOP.x,HOOP.y);spawnParticles(HOOP.x+HOOP.w/2,HOOP.y,30,currP.usingRainbow?[`hsl(${hue}, 70%, 60%)`]:['#fff','#ffd700']);updateTopBarUI();
}
function handleAirball(){currP.streak=0;showMsg("AIRBALL -1",'#e74c3c');if(!isInfinite)currP.score=Math.max(0,currP.score-1);spawnFloatScore(-1,player.x,player.y-50);updateTopBarUI();}
function showMsg(t,c){msgEl.innerText=t;msgEl.style.color=c;msgEl.className='';void msgEl.offsetWidth;msgEl.classList.add('pop');setTimeout(()=>msgEl.classList.remove('pop'),800);}
function showTurnMessage(t,c){turnMsg.innerText=t;turnMsg.style.color=c;turnMsg.classList.add('show');setTimeout(()=>turnMsg.classList.remove('show'),1500);}
function spawnParticles(x,y,n,cs){for(let i=0;i<n;i++)particles.push({x:x,y:y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:1,col:cs[Math.floor(Math.random()*cs.length)]});}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){particles[i].x+=particles[i].vx;particles[i].y+=particles[i].vy;particles[i].life-=0.05;if(particles[i].life<=0)particles.splice(i,1);}}
function drawParticles(){particles.forEach(p=>{let sz=p.life>0.5?4:2;pixelRect(ctx,p.x,p.y,sz,sz,p.col);});}
function spawnFloatScore(p,x,y,t){floatScores.push({val:p,text:t,x:x,y:y,life:1.0});}
function updateFloatScores(){for(let i=floatScores.length-1;i>=0;i--){floatScores[i].y-=1;floatScores[i].life-=0.02;if(floatScores[i].life<=0)floatScores.splice(i,1);}}
function drawFloatScores(){floatScores.forEach(f=>{ctx.globalAlpha=f.life;ctx.font='16px "Press Start 2P"';if(f.text){ctx.fillStyle='#00e676';ctx.fillText(f.text,f.x,f.y);}else{ctx.fillStyle=f.val>0?'#f1c40f':'#7f8c8d';ctx.fillText(f.val>0?"+"+f.val:f.val,f.x,f.y);}ctx.globalAlpha=1.0;});}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawEnvironment();drawParticles();drawHoopBack();
    drawPlayer();drawZoneIndicator();
    balls.forEach(b => drawBall(b));
    drawFloatingItem(); 
    drawHoopFront();drawFloatScores();
    if(gameState===STATE.AIMING)drawUI();
    if(isInfinite)drawPipe();
}
function drawZoneIndicator(){if(isInfinite&&neonZone.active){if(player.x>neonZone.x-20&&player.x<neonZone.x+neonZone.w+20){ctx.save();let y=player.y-90+Math.sin(Date.now()/100)*3;ctx.textAlign="center";ctx.font='10px "Press Start 2P"';ctx.fillStyle="#e056fd";ctx.shadowColor="#fff";ctx.shadowBlur=5;ctx.fillText("🔥X2",player.x,y);ctx.restore();}}}
function drawPipe(){ctx.fillStyle='#2ecc71';pixelRect(ctx,0,240,40,20,'#27ae60');pixelRect(ctx,36,236,10,28,'#2ecc71');pixelRect(ctx,40,242,4,16,'#145a32');}
function drawEnvironment(){
    if(customBgImage){ctx.save();ctx.beginPath();ctx.rect(0,0,canvas.width,GAME_CONFIG.PHYSICS.GROUND_Y);ctx.clip();ctx.imageSmoothingEnabled=false;const tw=80,th=50,oc=document.createElement('canvas');oc.width=tw;oc.height=th;const ox=oc.getContext('2d');ox.drawImage(customBgImage,0,0,tw,th);ctx.drawImage(oc,0,0,tw,th,0,0,canvas.width,GAME_CONFIG.PHYSICS.GROUND_Y);ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(0,0,canvas.width,GAME_CONFIG.PHYSICS.GROUND_Y);ctx.restore();}else{ctx.fillStyle='#5d4037';ctx.fillRect(0,0,canvas.width,GAME_CONFIG.PHYSICS.GROUND_Y);let bh=40,bw=80;for(let y=0;y<GAME_CONFIG.PHYSICS.GROUND_Y;y+=bh){let off=(y/bh%2)*(bw/2);for(let x=-bw;x<canvas.width;x+=bw){pixelRect(ctx,x+off,y,4,bh,'#3e2723');pixelRect(ctx,0,y,canvas.width,4,'#3e2723');}}}
    ctx.fillStyle='#7f8c8d';ctx.fillRect(0,GAME_CONFIG.PHYSICS.GROUND_Y,canvas.width,canvas.height-GAME_CONFIG.PHYSICS.GROUND_Y);
    if(isInfinite&&neonZone.active){ctx.save();let a=0.5+Math.sin(Date.now()/100)*0.3,zh=(Date.now()/10)%360;ctx.shadowBlur=20;ctx.shadowColor=`hsl(${zh},100%,50%)`;ctx.fillStyle=`hsla(${zh},100%,50%,${a*0.6})`;ctx.fillRect(neonZone.x,GAME_CONFIG.PHYSICS.GROUND_Y,neonZone.w,canvas.height-GAME_CONFIG.PHYSICS.GROUND_Y);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeRect(neonZone.x,GAME_CONFIG.PHYSICS.GROUND_Y,neonZone.w,canvas.height-GAME_CONFIG.PHYSICS.GROUND_Y);ctx.fillStyle='#fff';ctx.font='10px "Press Start 2P"';ctx.shadowBlur=0;ctx.fillText("X2 ZONE",neonZone.x+5,GAME_CONFIG.PHYSICS.GROUND_Y+20);ctx.restore();}
    ctx.fillStyle='#95a5a6';for(let y=GAME_CONFIG.PHYSICS.GROUND_Y;y<canvas.height;y+=4)if(y%20===0)ctx.fillRect(0,y,canvas.width,2);
    ctx.fillStyle='#bdc3c7';for(let y=GAME_CONFIG.PHYSICS.GROUND_Y;y<canvas.height;y+=12)pixelRect(ctx,GAME_CONFIG.COURT.THREE_POINT_X,y,4,6,'#bdc3c7');ctx.font='12px "Press Start 2P"';ctx.fillStyle='#bdc3c7';ctx.fillText("3PT LINE",GAME_CONFIG.COURT.THREE_POINT_X-120,GAME_CONFIG.PHYSICS.GROUND_Y+30);
}
function drawPixelCharacter(c,px,py,ck,isShooting){
    const cd=GAME_CONFIG.CHARACTERS[ck]||GAME_CONFIG.CHARACTERS['curry'],sk=cd.skin,j=cd.jersey,sh='#ecf0f1',ft='#111';
    const pr=(x,y,w,h,cl)=>{c.fillStyle=cl;c.fillRect(Math.floor(x/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.floor(y/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(w/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(h/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE);};
    if(!isShooting){pr(px-14,py-8,12,8,ft);pr(px+2,py-8,12,8,ft);}else{pr(px-14,py-12,8,12,ft);pr(px+6,py-12,8,12,ft);}
    pr(px-12,py-18,8,10,sk);pr(px+4,py-18,8,10,sk);pr(px-14,py-28,28,12,sh);pr(px-12,py-44,24,18,j);
    c.fillStyle=(j==='#fff')?'#333':'#fff';pr(px-4,py-40,8,8,c.fillStyle);
    let hy=py-64;pr(px-12,hy,24,24,sk);pr(px-12,hy+4,24,4,j);pr(px-12,hy,24,4,'#111');c.fillStyle='#000';pr(px+4,hy+12,4,4,'#000');
    if(isShooting){pr(px+8,py-70,6,20,sk);pr(px-14,py-55,6,15,sk);}else{pr(px-18,py-40,6,12,sk);pr(px+12,py-40,6,12,sk);}
}
function drawPlayer(){let isShooting=!player.onGround;drawPixelCharacter(ctx,player.x,player.y,selectedChar,isShooting);}
function drawBall(b){
    let c = p1Color;
    if(b.scoreTimer > 0) {
        // FLASHING EFFECT FOR SCORED BALL
        if(Math.floor(Date.now() / 100) % 2 === 0) c = '#ffd700'; 
        else c = '#fff';
    }
    pixelCircle(ctx,b.x,b.y,b.r,c);
    ctx.fillStyle='rgba(0,0,0,0.2)';pixelRect(ctx,b.x-b.r+2,b.y-2,b.r*2-4,4,'rgba(0,0,0,0.2)');pixelRect(ctx,b.x-2,b.y-b.r+2,4,b.r*2-4,'rgba(0,0,0,0.2)');pixelRect(ctx,b.x-b.r/2,b.y-b.r/2,4,4,'rgba(255,255,255,0.3)');
}
function drawFloatingItem(){if(!floatingItem.active)return;let y=floatingItem.y+floatingItem.offset,sz=20*floatingItem.scale,c=floatingItem.type==='rainbow'?`hsl(${hue},70%,60%)`:'#00e676';pixelCircle(ctx,floatingItem.x,y,sz,c);ctx.fillStyle='#fff';ctx.font='10px "Press Start 2P"';ctx.textAlign='center';ctx.fillText("?",floatingItem.x,y+4);}
function drawUI(){
    if(gameState===STATE.AIMING){
        let barW = 120; let barH = 16; let barX = player.x - barW/2; let barY = player.y - 70; 
        ctx.fillStyle = '#222'; ctx.fillRect(barX, barY, barW, barH);
        
        // DYNAMIC GREEN ZONE
        let greenStart = getGreenZoneStart();
        let greenW = GAME_CONFIG.METER.GREEN_WIDTH;
        
        ctx.fillStyle = '#00e676'; ctx.fillRect(barX + (barW * greenStart), barY, barW * greenW, barH);
        ctx.fillStyle = '#000'; ctx.fillRect(barX + (barW * greenStart), barY, 1, barH); ctx.fillRect(barX + (barW * (greenStart + greenW)), barY, 1, barH);
        
        let fillPct = aimOscillator; let fillW = barW * fillPct;
        if(Math.abs(fillPct - (greenStart + greenW/2)) < 0.15) ctx.fillStyle = '#f1c40f'; else ctx.fillStyle = '#fff';
        ctx.fillRect(barX, barY, fillW, barH);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(barX, barY, barW, barH);
    }
}
function drawHoopBack(){pixelRect(ctx,HOOP.backX+10,HOOP.y-40,20,GAME_CONFIG.PHYSICS.GROUND_Y-HOOP.y+40,'#333');pixelRect(ctx,HOOP.backX,HOOP.y-80,12,120,'#ecf0f1');pixelRect(ctx,HOOP.backX+4,HOOP.y-35,8,40,'#c0392b');ctx.fillStyle='#90a4ae';for(let y=HOOP.y;y<HOOP.y+50;y+=8){pixelRect(ctx,HOOP.x+10+(y-HOOP.y)/2,y,4,4,'#90a4ae');pixelRect(ctx,HOOP.x+HOOP.w-10-(y-HOOP.y)/2,y,4,4,'#90a4ae');}}
function drawHoopFront(){pixelRect(ctx,HOOP.x,HOOP.y,HOOP.w,8,'#d35400');if(currP.pu_big.active){ctx.fillStyle='#00e676';ctx.font='10px "Press Start 2P"';ctx.fillText("BIG",HOOP.x+20,HOOP.y+20);}}