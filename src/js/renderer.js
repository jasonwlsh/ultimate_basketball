import { GAME_CONFIG } from './config.js';

// This module encapsulates all drawing logic.
// It is initialized with the canvas and returns a render function.

export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // All drawing helper functions are private to this module.
    function pixelRect(c,x,y,w,h,col){let _c,_x,_y,_w,_h,_col;if(c instanceof CanvasRenderingContext2D||(c.canvas&&c.fillStyle!==undefined)){_c=c;_x=x;_y=y;_w=w;_h=h;_col=col;}else{_c=ctx;_x=c;_y=x;_w=y;_h=w;_col=h;}if(!_c)return;_c.fillStyle=_col;_c.fillRect(Math.floor(_x/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.floor(_y/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(_w/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.ceil(_h/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE);}
    function pixelCircle(c,cx,cy,r,col){let _c,_cx,_cy,_r,_col;if(c instanceof CanvasRenderingContext2D||(c.canvas&&c.fillStyle!==undefined)){_c=c;_cx=cx;_cy=cy;_r=r;_col=col;}else{_c=ctx;_cx=c;_cy=cx;_r=cy;_col=r;}if(!_c)return;_c.fillStyle=_col;let step=GAME_CONFIG.PIXEL_SIZE;for(let y=-_r;y<=_r;y+=step){for(let x=-_r;x<=_r;x+=step){if(x*x+y*y<=_r*_r){_c.fillRect(Math.floor((_cx+x)/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,Math.floor((_cy+y)/GAME_CONFIG.PIXEL_SIZE)*GAME_CONFIG.PIXEL_SIZE,step,step);}}}}
    function drawParticles(particles){particles.forEach(p=>{let sz=p.life>0.5?4:2;pixelRect(ctx,p.x,p.y,sz,sz,p.col);});}
    function drawFloatScores(floatScores){floatScores.forEach(f=>{ctx.globalAlpha=f.life;ctx.font='16px "Press Start 2P"';if(f.text){ctx.fillStyle='#00e676';ctx.fillText(f.text,f.x,f.y);}else{ctx.fillStyle=f.val>0?'#f1c40f':'#7f8c8d';ctx.fillText(f.val>0?"+"+f.val:f.val,f.x,f.y);}ctx.globalAlpha=1.0;});}
    function drawZoneIndicator(isInfinite, neonZone, player){if(isInfinite&&neonZone.active){if(player.x>neonZone.x-20&&player.x<neonZone.x+neonZone.w+20){ctx.save();let y=player.y-90+Math.sin(Date.now()/100)*3;ctx.textAlign="center";ctx.font='10px "Press Start 2P"';ctx.fillStyle="#e056fd";ctx.shadowColor="#fff";ctx.shadowBlur=5;ctx.fillText("🔥X2",player.x,y);ctx.restore();}}}
    function drawPipe(){ctx.fillStyle='#2ecc71';pixelRect(ctx,0,240,40,20,'#27ae60');pixelRect(ctx,36,236,10,28,'#2ecc71');pixelRect(ctx,40,242,4,16,'#145a32');}
    function drawEnvironment(customBgImage, isInfinite, neonZone){
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
    function drawPlayer(player, selectedChar){let isShooting=!player.onGround;drawPixelCharacter(ctx,player.x,player.y,selectedChar,isShooting);}
    function drawBall(b, p1Color){
        let c = p1Color;
        if(b.scoreTimer > 0) {
            if(Math.floor(Date.now() / 100) % 2 === 0) c = '#ffd700'; 
            else c = '#fff';
        }
        pixelCircle(ctx,b.x,b.y,b.r,c);
        ctx.fillStyle='rgba(0,0,0,0.2)';pixelRect(ctx,b.x-b.r+2,b.y-2,b.r*2-4,4,'rgba(0,0,0,0.2)');pixelRect(ctx,b.x-2,b.y-b.r+2,4,b.r*2-4,'rgba(0,0,0,0.2)');pixelRect(ctx,b.x-b.r/2,b.y-b.r/2,4,4,'rgba(255,255,255,0.3)');
    }
    function drawFloatingItem(floatingItem, hue){if(!floatingItem.active)return;let y=floatingItem.y+floatingItem.offset,sz=20*floatingItem.scale,c=floatingItem.type==='rainbow'?`hsl(${hue},70%,60%)`:'#00e676';pixelCircle(ctx,floatingItem.x,y,sz,c);ctx.fillStyle='#fff';ctx.font='10px "Press Start 2P"';ctx.textAlign='center';ctx.fillText("?",floatingItem.x,y+4);}
    function drawUI(player, gameState, aimOscillator, getGreenZoneStart){
        if(gameState===1 /* AIMING */){
            let barW = 120; let barH = 16; let barX = player.x - barW/2; let barY = player.y - 70; 
            ctx.fillStyle = '#222'; ctx.fillRect(barX, barY, barW, barH);
            
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
    function drawHoopBack(HOOP){pixelRect(ctx,HOOP.backX+10,HOOP.y-40,20,GAME_CONFIG.PHYSICS.GROUND_Y-HOOP.y+40,'#333');pixelRect(ctx,HOOP.backX,HOOP.y-80,12,120,'#ecf0f1');pixelRect(ctx,HOOP.backX+4,HOOP.y-35,8,40,'#c0392b');ctx.fillStyle='#90a4ae';for(let y=HOOP.y;y<HOOP.y+50;y+=8){pixelRect(ctx,HOOP.x+10+(y-HOOP.y)/2,y,4,4,'#90a4ae');pixelRect(ctx,HOOP.x+HOOP.w-10-(y-HOOP.y)/2,y,4,4,'#90a4ae');}}
    function drawHoopFront(HOOP, currP){pixelRect(ctx,HOOP.x,HOOP.y,HOOP.w,8,'#d35400');if(currP.pu_big.active){ctx.fillStyle='#00e676';ctx.font='10px "Press Start 2P"';ctx.fillText("BIG",HOOP.x+20,HOOP.y+20);}}

    return {
        render: function(state) {
            const {
                customBgImage, isInfinite, neonZone, particles, HOOP, player, 
                selectedChar, balls, p1Color, floatingItem, hue, floatScores, 
                gameState, currP, aimOscillator, getGreenZoneStart
            } = state;

            ctx.clearRect(0,0,canvas.width,canvas.height);
            drawEnvironment(customBgImage, isInfinite, neonZone);
            drawParticles(particles);
            drawHoopBack(HOOP);
            drawPlayer(player, selectedChar);
            drawZoneIndicator(isInfinite, neonZone, player);
            balls.forEach(b => drawBall(b, p1Color));
            drawFloatingItem(floatingItem, hue); 
            drawHoopFront(HOOP, currP);
            drawFloatScores(floatScores);
            if(gameState===1 /* AIMING */) drawUI(player, gameState, aimOscillator, getGreenZoneStart);
            if(isInfinite) drawPipe();
        },
        renderCharPreview: function(canvasId, charKey) {
            const c = document.getElementById(canvasId);
            if(!c) return;
            const previewCtx = c.getContext('2d');
            previewCtx.clearRect(0,0,c.width,c.height);
            previewCtx.save();
            drawPixelCharacter(previewCtx, 50, 110, charKey, false);
            previewCtx.restore();
        }
    };
}
