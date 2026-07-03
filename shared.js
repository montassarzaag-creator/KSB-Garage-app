// shared.js — KSB Garage Manager
// Configuration Firebase, authentification, persistance hors-ligne, helpers communs
// Importé par toutes les pages via : <script type="module" src="shared.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Configuration Firebase du projet ksb-garage-manager ---

const firebaseConfig = {
  apiKey: "AIzaSyCn6PZPaeOFW41mCJudrvWaP7CFy3Nv7fY",
  authDomain: "ksb-garage-manager.firebaseapp.com",
  projectId: "ksb-garage-manager",
  storageBucket: "ksb-garage-manager.firebasestorage.app",
  messagingSenderId: "273008175623",
  appId: "1:273008175623:web:2bd5fc28e83471bc1058a2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Persistance hors-ligne : les documents déjà consultés restent lisibles
// sans réseau, et les écritures faites hors-ligne sont mises en file
// d'attente puis synchronisées au retour de la connexion.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// --- Authentification (simple, sans rôles pour l'instant) ---

function connecter(email, motDePasse) {
  return signInWithEmailAndPassword(auth, email, motDePasse);
}

function deconnecter() {
  return signOut(auth);
}

function surChangementAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Protège une page : redirige vers login.html si personne n'est connecté.
// A appeler en haut de chaque page sauf login.html.
function protegerPage() {
  surChangementAuth((utilisateur) => {
    if (!utilisateur) {
      window.location.href = "login.html";
    }
  });
}

// --- Etat de la connexion réseau (pour l'indicateur visuel hors-ligne) ---

let enLigne = navigator.onLine;
const ecouteursEtatReseau = [];

function surChangementReseau(callback) {
  ecouteursEtatReseau.push(callback);
  callback(enLigne);
}

window.addEventListener("online", () => {
  enLigne = true;
  ecouteursEtatReseau.forEach((cb) => cb(true));
});
window.addEventListener("offline", () => {
  enLigne = false;
  ecouteursEtatReseau.forEach((cb) => cb(false));
});

// --- Numérotation des documents ---
// Format : PREFIXE-ANNEE-SEQUENCE (ex : DOS-2026-000451)
// La séquence est stockée dans un document compteur pour éviter les doublons.
// Préfixes suggérés : DOS (dossier), DEV (devis), FAC (facture), BC (bon de commande)

async function prochainNumero(prefixe) {
  const annee = new Date().getFullYear();
  const cleCompteur = `${prefixe}-${annee}`;
  const refCompteur = doc(db, "compteurs", cleCompteur);
  const snap = await getDoc(refCompteur);
  let sequence = 1;
  if (snap.exists()) { sequence = (snap.data().valeur || 0) + 1; }
  await setDoc(refCompteur, { valeur: sequence, misAJour: serverTimestamp() }, { merge: true });
  const sequenceFormatee = String(sequence).padStart(6, "0");
  return `${prefixe}-${annee}-${sequenceFormatee}`;
}

// --- Calcul de marge ---

function calculerCoutReel(prixAchat, transport = 0, douane = 0, autresFrais = 0) {
  return prixAchat + transport + douane + autresFrais;
}

function calculerPrixVente(coutReel, tauxMargePct) {
  return Math.round(coutReel * (1 + tauxMargePct / 100));
}

function calculerMargePct(coutReel, prixVente) {
  if (!coutReel) return 0;
  return Math.round(((prixVente - coutReel) / coutReel) * 1000) / 10;
}

// --- Historique / traçabilité ---
// Enregistre une entrée dans la collection "historique" pour tracer les
// actions sensibles (changement de statut, saut d'étape, modification de prix...).

async function journaliser(module, action, cibleId, details = {}) {
  const utilisateur = auth.currentUser;
  return addDoc(collection(db, "historique"), {
    module,
    action,
    cibleId,
    details,
    parUid: utilisateur ? utilisateur.uid : null,
    parEmail: utilisateur ? utilisateur.email : null,
    horodatage: serverTimestamp()
  });
}

// --- Formatage ---

function formaterFCFA(montant) {
  const nombre = Number(montant) || 0;
  return nombre.toLocaleString("fr-FR").replace(/,/g, " ") + " FCFA";
}

export {
  app, auth, db,
  connecter, deconnecter, surChangementAuth, protegerPage,
  surChangementReseau,
  prochainNumero,
  calculerCoutReel, calculerPrixVente, calculerMargePct,
  journaliser,
  formaterFCFA,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot
};
