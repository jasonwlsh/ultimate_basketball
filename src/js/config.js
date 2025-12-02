// --- 遊戲全域設定 ---
export const GAME_CONFIG = {
    // 物理相關設定
    PHYSICS: {
        GRAVITY: 0.55, // 重力
        AIR_FRICTION: 0.99, // 空氣阻力
        BALL_BOUNCE: 0.6, // 球的反彈係數
        RIM_BOUNCE: 0.55, // 籃筐的反彈係數
        WALL_BOUNCE_INFINITE: 0.1, // 無限模式下牆壁的反彈係數
        GROUND_Y: 520 // 地面Y座標
    },
    // 球場相關設定
    COURT: {
        THREE_POINT_X: 400, // 三分線X座標
        HOOP_X: 800, // 籃筐X座標
        HOOP_Y: 240, // 籃筐Y座標
        HOOP_W: 70 // 籃筐寬度
    },
    // 投籃力度計相關設定
    METER: {
        SPEED: 0.030, // 力度計擺動速度
        GREEN_WIDTH: 0.06, // 完美出手區域寬度
        GREEN_TOLERANCE: 0.025, // 完美出手容錯率
        GOLD_ZONE_START: 0.97, // 黃金灌籃區起點
        GOLD_ZONE_TOLERANCE: 0.03 // 黃金灌籃區容錯率
    },
    // 遊戲模式相關設定
    GAME: {
        TOTAL_BALLS_CLASSIC: 6, // 經典模式總球數
        INFINITE_TIME: 60, // 無限模式時間
        PIPE_BALL_SPEED: 7, // 無限模式出球速度
        HOT_ZONE_DURATION: 10.0, // 得分熱區持續時間
        HOT_ZONE_RESPAWN_DELAY: 1.0, // 得分熱區重生延遲
        MAX_BALLS_ON_COURT: 6 // 場上最大球數
    },
    // 角色設定
    CHARACTERS: {
        curry: { name: 'CURRY', skin: '#f1c27d', jersey: '#fff', speed: 10, zone: '3PT' },
        lbj: { name: 'LBJ(GOAT)', skin: '#5d4037', jersey: '#f1c40f', speed: 8, zone: 'MID' }
    },
    PIXEL_SIZE: 4 // 像素大小 (用於像素化繪圖)
};
