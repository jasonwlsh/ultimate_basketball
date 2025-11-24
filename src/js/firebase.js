// 引入 Firebase 各項服務
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, setDoc, doc, getDoc, serverTimestamp, query, where, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml } from './utils.js';

let app, auth, db, currentUser, appId;

export function initFirebase() {
    let firebaseConfig;
    // 檢查是否有外部傳入的 Firebase 設定
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
        appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
    } else {
        firebaseConfig = { apiKey: "AIzaSyDizpxgLQfGMVFRfakfs1MwuhF4k4ZRLP4", authDomain: "streetball-ultimate-rank.firebaseapp.com", projectId: "streetball-ultimate-rank", storageBucket: "streetball-ultimate-rank.firebasestorage.app", messagingSenderId: "1081286196484", appId: "1:1081286196484:web:0677e0eab585c583faa451", measurementId: "G-ZP9H5GTLNV" };
        appId = firebaseConfig.projectId;
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

export async function initAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        currentUser = auth.currentUser;
        return currentUser;
    } catch (e) {
        console.error("Auth failed.", e);
        return null;
    }
}

export async function logScoreHistory(name, score) {
    if (!currentUser || score <= 0) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'score_history'), { name: name, score: score, uid: currentUser.uid, date: serverTimestamp() });
    } catch (e) {
        console.error(e);
    }
}

export async function fetchScoreHistory() {
    if (!currentUser) return [];
    try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'score_history'), orderBy('date', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return [];
        }
        let history = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            history.push({
                time: d.date?.toDate() ? d.date.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A',
                name: escapeHtml(d.name),
                score: d.score
            });
        });
        return history;
    } catch (e) {
        console.error("Error fetching history:", e);
        return []; // graceful fallback for local preview
    }
}

function processScores(s) {
    let r = [];
    s.forEach(d => {
        let dt = d.data();
        if (dt.score !== undefined && dt.name) r.push({ ...dt, id: d.id });
    });
    r.sort((a, b) => b.score - a.score);
    return r;
}

function removeScoreDuplicates(a) {
    const u = {};
    a.forEach(s => {
        if (!u[s.uid] || s.score > u[s.uid].score) u[s.uid] = s;
    });
    return Object.values(u).sort((a, b) => b.score - a.score);
}


export async function fetchLeaderboard() {
     if (!currentUser) return [];
    try {
        const s = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'));
        let sc = processScores(s);
        return removeScoreDuplicates(sc).slice(0, 5);
    } catch (e) {
        console.error("Error fetching leaderboard:", e);
        return [];
    }
}


export async function uploadScore(name, score, isGoldUnlocked) {
    if (!currentUser) return { error: true };
    
    try {
        if (score > 0) await logScoreHistory(name, score);
        
        const col = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
        const usnap = await getDocs(query(col, where("uid", "==", currentUser.uid)));
        
        let userScores = [];
        usnap.forEach(d => userScores.push({ score: d.data().score, id: d.id }));
        
        let currentBest = userScores.reduce((m, s) => Math.max(m, s.score), 0);

        if (score > currentBest) {
            await Promise.all(userScores.map(s => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', s.id))));
            await addDoc(col, { name: name, score: score, uid: currentUser.uid, date: serverTimestamp() });

            const allScoresRaw = await getDocs(col);
            const allScoresProcessed = processScores(allScoresRaw);
            const uniqueScores = removeScoreDuplicates(allScoresProcessed);
            
            let rank = uniqueScores.findIndex(s => s.uid === currentUser.uid) + 1;
            let total = uniqueScores.length;
            let lowerCount = uniqueScores.filter(s => score > s.score).length;
            let percentile = total > 0 ? Math.round((lowerCount / total) * 100) : 0;
            if (total === 1) percentile = 100;

            let newSkinUnlocked = false;
            if (rank <= 5 && !isGoldUnlocked) {
                newSkinUnlocked = true;
            }
            
            return {
                isNewRecord: true,
                rank,
                percentile,
                newSkinUnlocked
            };
        } else {
            return {
                isNewRecord: false,
                best: currentBest
            };
        }
    } catch (e) {
        console.error("Upload score error:", e);
        return { error: true };
    }
}


export async function loadProfile() {
    if (!currentUser) return null;
    try {
        const d = await getDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile'));
        if (d.exists()) {
            return d.data();
        }
        return null;
    } catch (e) {
        console.error("Load profile error:", e);
        return null;
    }
}

export async function saveProfile(profileData) {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile'), {
            ...profileData,
            lastUpdated: serverTimestamp()
        });
    } catch (e) {
        console.error("Save profile error:", e);
    }
}
