// --- START OF FILE script.js ---

// Import Firebase modular SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Constantes e Dados ---

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCv1G4CoK4EwZ6iMZ2CLCUdSg4YLFTuVKI",
  authDomain: "plano-leitura-biblia-8f763.firebaseapp.com",
  projectId: "plano-leitura-biblia-8f763",
  storageBucket: "plano-leitura-biblia-8f763.firebasestorage.app",
  messagingSenderId: "4101180633",
  appId: "1:4101180633:web:32d7846cf9a031962342c8",
  measurementId: "G-KT5PPGF7W1"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Dados da Bíblia
const bibleBooksChapters = {
    "Gênesis": 50, "Êxodo": 40, "Levítico": 27, "Números": 36, "Deuteronômio": 34,
    "Josué": 24, "Juízes": 21, "Rute": 4, "1 Samuel": 31, "2 Samuel": 24,
    "1 Reis": 22, "2 Reis": 25, "1 Crônicas": 29, "2 Crônicas": 36, "Esdras": 10,
    "Neemias": 13, "Ester": 10, "Jó": 42, "Salmos": 150, "Provérbios": 31,
    "Eclesiastes": 12, "Cantares": 8, "Isaías": 66, "Jeremias": 52, "Lamentações": 5,
    "Ezequiel": 48, "Daniel": 12, "Oséias": 14, "Joel": 3, "Amós": 9, "Obadias": 1,
    "Jonas": 4, "Miquéias": 7, "Naum": 3, "Habacuque": 3, "Sofonias": 3, "Ageu": 2,
    "Zacarias": 14, "Malaquias": 4, "Mateus": 28, "Marcos": 16, "Lucas": 24, "João": 21,
    "Atos": 28, "Romanos": 16, "1 Coríntios": 16, "2 Coríntios": 13, "Gálatas": 6,
    "Efésios": 6, "Filipenses": 4, "Colossenses": 4, "1 Tessalonicenses": 5,
    "2 Tessalonicenses": 3, "1 Timóteo": 6, "2 Timóteo": 4, "Tito": 3, "Filemom": 1,
    "Hebreus": 13, "Tiago": 5, "1 Pedro": 5, "2 Pedro": 3, "1 João": 5, "2 João": 1,
    "3 João": 1, "Judas": 1, "Apocalipse": 22
};
const canonicalBookOrder = Object.keys(bibleBooksChapters);
const bookNameMap = new Map();
canonicalBookOrder.forEach(book => {
    const lower = book.toLowerCase();
    const lowerNoSpace = lower.replace(/\s+/g, '');
    bookNameMap.set(lower, book);
    if (lower !== lowerNoSpace) bookNameMap.set(lowerNoSpace, book);
});

// --- Estado da Aplicação ---
let currentUser = null;
let userInfo = null;
let activePlanId = null;
// Estrutura esperada para currentReadingPlan:
// { id, name, plan, currentDay, startDate, endDate, allowedDays, chaptersList, googleDriveLink,
//   readLog, weeklyInteractions, readAheadDates, // <-- NOVO readAheadDates
//   createdAt, totalChapters,
//   recalculationBaseDay?, recalculationBaseDate? }
let currentReadingPlan = null;
let userPlansList = []; // Lista de todos os planos do usuário
let currentWeeklyInteractions = { weekId: null, interactions: {} };
let userStreakData = { lastInteractionDate: null, current: 0, longest: 0 }; // Estado da Sequência
// *** NOVO: Estado para Read Ahead ***
let isReadAheadPossible = false; // Flag para indicar se o próximo clique pode ser "adiantado"
let readAheadTimeoutId = null; // ID do timeout para resetar isReadAheadPossible
const READ_AHEAD_TIMEOUT_MS = 2500; // 2.5 segundos para o segundo clique

// --- Elementos da UI (Cache) ---
const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const logoutButton = document.getElementById('logout-button');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const userEmailSpan = document.getElementById('user-email');
const authErrorDiv = document.getElementById('auth-error');
const signupErrorDiv = document.getElementById('signup-error');
const authLoadingDiv = document.getElementById('auth-loading');
const planSelectorContainer = document.getElementById('plan-selector-container');
const planSelect = document.getElementById('plan-select');
const managePlansButton = document.getElementById('manage-plans-button');
const planCreationSection = document.getElementById('plan-creation');
const planNameInput = document.getElementById('plan-name');
const googleDriveLinkInput = document.getElementById('google-drive-link');
const startBookSelect = document.getElementById("start-book-select");
const startChapterInput = document.getElementById("start-chapter-input");
const endBookSelect = document.getElementById("end-book-select");
const endChapterInput = document.getElementById("end-chapter-input");
const booksSelect = document.getElementById("books-select");
const chaptersInput = document.getElementById("chapters-input");
const bookSuggestionsDatalist = document.getElementById("book-suggestions");
const daysInput = document.getElementById("days-input");
const createPlanButton = document.getElementById('create-plan');
const cancelCreationButton = document.getElementById('cancel-creation-button');
const planErrorDiv = document.getElementById('plan-error');
const planLoadingCreateDiv = document.getElementById('plan-loading-create');
const creationMethodRadios = document.querySelectorAll('input[name="creation-method"]');
const intervalOptionsDiv = document.getElementById('interval-options');
const selectionOptionsDiv = document.getElementById('selection-options');
const durationMethodRadios = document.querySelectorAll('input[name="duration-method"]');
const daysOptionDiv = document.getElementById('days-option');
const endDateOptionDiv = document.getElementById('end-date-option');
const startDateInput = document.getElementById('start-date-input');
const endDateInput = document.getElementById('end-date-input');
const chaptersPerDayOptionDiv = document.getElementById('chapters-per-day-option');
const chaptersPerDayInput = document.getElementById('chapters-per-day-input');
const periodicityCheckboxes = document.querySelectorAll('input[name="reading-day"]');
const periodicityWarningDiv = document.getElementById('periodicity-warning');
const readingPlanSection = document.getElementById('reading-plan');
const readingPlanTitle = document.getElementById('reading-plan-title');
const activePlanDriveLink = document.getElementById('active-plan-drive-link');
const overdueReadingsSection = document.getElementById('overdue-readings');
const overdueReadingsListDiv = document.getElementById('overdue-readings-list');
const overdueReadingsLoadingDiv = document.getElementById('overdue-readings-loading');
const upcomingReadingsSection = document.getElementById('upcoming-readings');
const upcomingReadingsListDiv = document.getElementById('upcoming-readings-list');
const upcomingReadingsLoadingDiv = document.getElementById('upcoming-readings-loading');
const planViewErrorDiv = document.getElementById('plan-view-error');
const progressBarContainer = document.querySelector('.progress-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const dailyReadingDiv = document.getElementById('daily-reading');
const markAsReadButton = document.getElementById('mark-as-read');
const deleteCurrentPlanButton = document.getElementById('delete-current-plan-button');
const planLoadingViewDiv = document.getElementById('plan-loading-view');
const weeklyTrackerContainer = document.getElementById('weekly-tracker');
const dayIndicatorElements = document.querySelectorAll('.day-indicator');
const recalculatePlanButton = document.getElementById('recalculate-plan');
const showStatsButton = document.getElementById('show-stats-button');
const showHistoryButton = document.getElementById('show-history-button');
const recalculateModal = document.getElementById('recalculate-modal');
const confirmRecalculateButton = document.getElementById('confirm-recalculate');
const newPaceInput = document.getElementById('new-pace-input');
const recalculateErrorDiv = document.getElementById('recalculate-error');
const recalculateLoadingDiv = document.getElementById('recalculate-loading');
const managePlansModal = document.getElementById('manage-plans-modal');
const managePlansLoadingDiv = document.getElementById('manage-plans-loading');
const managePlansErrorDiv = document.getElementById('manage-plans-error');
const planListDiv = document.getElementById('plan-list');
const createNewPlanButton = document.getElementById('create-new-plan-button');
const statsModal = document.getElementById('stats-modal');
const statsLoadingDiv = document.getElementById('stats-loading');
const statsErrorDiv = document.getElementById('stats-error');
const statsContentDiv = document.getElementById('stats-content');
const statsActivePlanName = document.getElementById('stats-active-plan-name');
const statsActivePlanProgress = document.getElementById('stats-active-plan-progress');
const statsTotalChapters = document.getElementById('stats-total-chapters');
const statsPlansCompleted = document.getElementById('stats-plans-completed');
const statsAvgPace = document.getElementById('stats-avg-pace');
const historyModal = document.getElementById('history-modal');
const historyLoadingDiv = document.getElementById('history-loading');
const historyErrorDiv = document.getElementById('history-error');
const historyListDiv = document.getElementById('history-list');
const streakCounterSection = document.getElementById('streak-counter-section');
const currentStreakValue = document.getElementById('current-streak-value');
const longestStreakValue = document.getElementById('longest-streak-value');

// --- Funções Auxiliares (Datas, Semana, Geração, Distribuição, Cálculo de Data) ---

/** Retorna a data UTC atual no formato YYYY-MM-DD */
function getCurrentUTCDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/** Retorna o ID da semana UTC (ex: 2023-W35) para uma data */
function getUTCWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Ajusta para ISO 8601 week date
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/** Retorna a data de início da semana UTC (Domingo) para uma data */
function getUTCWeekStartDate(date = new Date()) {
    const currentDayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = date.getUTCDate() - currentDayOfWeek;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
}

/** Calcula a diferença em dias entre duas datas (considerando apenas a parte da data) */
function dateDiffInDays(dateStr1, dateStr2) {
    const date1 = new Date(dateStr1 + 'T00:00:00Z');
    const date2 = new Date(dateStr2 + 'T00:00:00Z');
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return Infinity; // Retorna Infinity se inválido
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.floor((date2.getTime() - date1.getTime()) / _MS_PER_DAY);
}

/** Adiciona um número de dias a uma data UTC e retorna a nova data como objeto Date */
function addUTCDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

/** Formata uma data UTC ('YYYY-MM-DD') para 'DD/MM/YYYY' */
function formatUTCDateStringToBrasilian(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return '--/--/----';
    }
    try {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return '--/--/----';
    }
}

/**
 * Calcula a data do calendário real para um determinado "dia" do plano.
 * Leva em conta a data de início do plano e os dias da semana permitidos.
 * Esta função é a BASE, não considera recálculos por si só.
 * @param {string} baseDateStr - Data base no formato 'YYYY-MM-DD' a partir da qual contar.
 * @param {number} targetReadingDayCount - Qual dia de leitura estamos buscando (1º, 2º, etc.) a partir da baseDateStr.
 * @param {number[]} allowedDaysOfWeek - Array com os dias da semana permitidos (0=Dom, 1=Seg...).
 * @returns {string|null} A data calculada no formato 'YYYY-MM-DD' ou null se inválido.
 */
function calculateDateForDay(baseDateStr, targetReadingDayCount, allowedDaysOfWeek) {
    if (!baseDateStr || isNaN(targetReadingDayCount) || targetReadingDayCount < 1 || !Array.isArray(allowedDaysOfWeek)) {
        console.error("Invalid input for calculateDateForDay", { baseDateStr, targetReadingDayCount, allowedDaysOfWeek });
        return null;
    }

    const baseDate = new Date(baseDateStr + 'T00:00:00Z');
    if (isNaN(baseDate.getTime())) {
        console.error("Invalid base date provided to calculateDateForDay:", baseDateStr);
        return null;
    }

    const validAllowedDays = allowedDaysOfWeek.length > 0 ? allowedDaysOfWeek : [0, 1, 2, 3, 4, 5, 6];

    let currentDate = new Date(baseDate);
    let daysElapsed = 0;
    let readingDaysFound = 0;

    while (readingDaysFound < targetReadingDayCount) {
        if (validAllowedDays.includes(currentDate.getUTCDay())) {
            readingDaysFound++;
        }

        if (readingDaysFound === targetReadingDayCount) {
            return currentDate.toISOString().split('T')[0];
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        daysElapsed++;

        if (daysElapsed > 365 * 10) {
            console.error("Potential infinite loop in calculateDateForDay. Aborting.", { baseDateStr, targetReadingDayCount, allowedDaysOfWeek });
            return null;
        }
    }
    return null; // Não deveria chegar aqui
}


/**
 * Calcula a data do calendário para um determinado "dia" do plano,
 * considerando a data de início original E possíveis recálculos.
 * @param {object} planData - O objeto completo do plano (precisa de startDate, allowedDays, e opcionalmente recalculationBaseDate/Day).
 * @param {number} targetDayNumber - O número do dia do plano (ex: 1, 2, 3...).
 * @returns {string|null} A data calculada no formato 'YYYY-MM-DD' ou null se inválido.
 */
function getEffectiveDateForDay(planData, targetDayNumber) {
    if (!planData || !planData.startDate || !planData.allowedDays || isNaN(targetDayNumber) || targetDayNumber < 1) {
        console.error("Invalid input for getEffectiveDateForDay", { planData: planData ? planData.id : 'no plan', targetDayNumber });
        return null;
    }

    // Verifica se houve um recálculo e se estamos buscando um dia igual ou posterior ao recálculo
    if (planData.recalculationBaseDate && planData.recalculationBaseDay &&
        /^\d{4}-\d{2}-\d{2}$/.test(planData.recalculationBaseDate) && // Valida formato da data base
        targetDayNumber >= planData.recalculationBaseDay)
    {
        const readingDaysSinceBase = targetDayNumber - planData.recalculationBaseDay;
        const targetDayFromBase = readingDaysSinceBase + 1;
        const calculatedDate = calculateDateForDay(planData.recalculationBaseDate, targetDayFromBase, planData.allowedDays);
        // console.log(`[getEffectiveDateForDay - Recalc] Plan: ${planData.id}, TargetDay: ${targetDayNumber}, BaseDay: ${planData.recalculationBaseDay}, BaseDate: ${planData.recalculationBaseDate}, TargetDayFromBase: ${targetDayFromBase}, Result: ${calculatedDate}`);
        return calculatedDate;

    } else {
        // Nenhum recálculo aplicável a este dia, usa a data de início original
        const calculatedDate = calculateDateForDay(planData.startDate, targetDayNumber, planData.allowedDays);
        // console.log(`[getEffectiveDateForDay - Original] Plan: ${planData.id}, TargetDay: ${targetDayNumber}, BaseDate: ${planData.startDate}, Result: ${calculatedDate}`);
        return calculatedDate;
    }
}


/** Popula os seletores de livros no formulário de criação */
function populateBookSelectors() {
    if (!startBookSelect || !endBookSelect || !booksSelect) { console.error("Erro: Elementos select de livros não encontrados."); return; }
    const defaultOption = '<option value="">-- Selecione --</option>';
    startBookSelect.innerHTML = defaultOption;
    endBookSelect.innerHTML = defaultOption;
    booksSelect.innerHTML = ''; // Múltiplo não tem default

    canonicalBookOrder.forEach(book => {
        const optionHTML = `<option value="${book}">${book}</option>`;
        startBookSelect.insertAdjacentHTML('beforeend', optionHTML);
        endBookSelect.insertAdjacentHTML('beforeend', optionHTML);
        booksSelect.insertAdjacentHTML('beforeend', optionHTML);
    });
}

/** Gera a lista de capítulos (ex: "Gênesis 1") para um intervalo de livros/capítulos */
function generateChaptersInRange(startBook, startChap, endBook, endChap) {
    const chapters = [];
    const startIndex = canonicalBookOrder.indexOf(startBook);
    const endIndex = canonicalBookOrder.indexOf(endBook);

    if (startIndex === -1 || endIndex === -1) { showErrorMessage(planErrorDiv, "Erro: Livro inicial ou final inválido."); return null; }
    if (startIndex > endIndex) { showErrorMessage(planErrorDiv, "Erro: O livro inicial deve vir antes do livro final."); return null; }
    if (isNaN(startChap) || startChap < 1 || startChap > bibleBooksChapters[startBook]) { showErrorMessage(planErrorDiv, `Erro: Capítulo inicial inválido para ${startBook} (máx ${bibleBooksChapters[startBook]}).`); return null; }
    if (isNaN(endChap) || endChap < 1 || endChap > bibleBooksChapters[endBook]) { showErrorMessage(planErrorDiv, `Erro: Capítulo final inválido para ${endBook} (máx ${bibleBooksChapters[endBook]}).`); return null; }
    if (startIndex === endIndex && startChap > endChap) { showErrorMessage(planErrorDiv, "Erro: Capítulo inicial maior que o final no mesmo livro."); return null; }

    for (let i = startIndex; i <= endIndex; i++) {
        const currentBook = canonicalBookOrder[i];
        const totalChapters = bibleBooksChapters[currentBook];
        const chapStart = (i === startIndex) ? startChap : 1;
        const chapEnd = (i === endIndex) ? endChap : totalChapters;
        for (let j = chapStart; j <= chapEnd; j++) {
            chapters.push(`${currentBook} ${j}`);
        }
    }
    return chapters;
}


/** Analisa a entrada de texto para capítulos/intervalos (ex: "Gn 1-3, Ex 5") */
function parseChaptersInput(inputString) {
    const chapters = new Set();
    const parts = inputString.split(',').map(p => p.trim()).filter(p => p);
    const bookPartRegex = `(?:\\d+\\s*)?[a-zA-ZÀ-úçõãíáéóú]+(?:\\s+[a-zA-ZÀ-úçõãíáéóú]+)*`;
    const chapterRegex = new RegExp(`^\\s*(${bookPartRegex})\\s*(\\d+)?(?:\\s*-\\s*(\\d+))?\\s*$`, 'i');

    parts.forEach(part => {
        const match = part.match(chapterRegex);
        if (match) {
            const inputBookNameRaw = match[1].trim();
            const inputBookNameLower = inputBookNameRaw.toLowerCase();
            const inputBookNameLowerNoSpace = inputBookNameLower.replace(/\s+/g, '');
            const bookName = bookNameMap.get(inputBookNameLower) || bookNameMap.get(inputBookNameLowerNoSpace);

            if (!bookName) {
                console.warn(`Nome de livro não reconhecido: "${inputBookNameRaw}"`);
                return;
            }

            const startChapter = match[2] ? parseInt(match[2], 10) : null;
            const endChapter = match[3] ? parseInt(match[3], 10) : null;
            const maxChapters = bibleBooksChapters[bookName];

            try {
                if (startChapter === null && endChapter === null) {
                    if (maxChapters) { for (let i = 1; i <= maxChapters; i++) chapters.add(`${bookName} ${i}`); }
                    else { console.warn(`Livro ${bookName} não encontrado nos dados da Bíblia.`); }
                } else if (startChapter !== null && endChapter === null) {
                    if (startChapter >= 1 && startChapter <= maxChapters) { chapters.add(`${bookName} ${startChapter}`); }
                    else { console.warn(`Capítulo inválido (${startChapter}) para ${bookName} (máx ${maxChapters}) na entrada: "${part}"`); }
                } else if (startChapter !== null && endChapter !== null) {
                    if (startChapter >= 1 && endChapter >= startChapter && endChapter <= maxChapters) { for (let i = startChapter; i <= endChapter; i++) chapters.add(`${bookName} ${i}`); }
                    else { console.warn(`Intervalo de capítulos inválido (${startChapter}-${endChapter}) para ${bookName} (máx ${maxChapters}) na entrada: "${part}"`); }
                }
            } catch (e) { console.error(`Erro processando parte "${part}": ${e}`); }
        } else { console.warn(`Não foi possível analisar a parte da entrada: "${part}"`); }
    });

    const uniqueChaptersArray = Array.from(chapters);
    uniqueChaptersArray.sort((a, b) => {
        const matchA = a.match(/^(.*)\s+(\d+)$/);
        const matchB = b.match(/^(.*)\s+(\d+)$/);
        if (!matchA || !matchB) return 0;
        const bookA = matchA[1]; const chapA = parseInt(matchA[2], 10);
        const bookB = matchB[1]; const chapB = parseInt(matchB[2], 10);
        const indexA = canonicalBookOrder.indexOf(bookA);
        const indexB = canonicalBookOrder.indexOf(bookB);
        if (indexA === -1 || indexB === -1) return 0;
        if (indexA !== indexB) return indexA - indexB;
        return chapA - chapB;
    });
    return uniqueChaptersArray;
}


/**
 * Distribui os capítulos ao longo dos dias *de leitura*, criando o mapa do plano.
 * @param {string[]} chaptersToRead - Array de capítulos (ex: ["Gênesis 1", "Gênesis 2"]).
 * @param {number} totalReadingDays - O número total de dias *em que haverá leitura*.
 * @returns {object} O mapa do plano { '1': ["Gn 1", "Gn 2"], '2': ["Gn 3"], ... }.
 */
function distributeChaptersOverReadingDays(chaptersToRead, totalReadingDays) {
    const planMap = {};
    const totalChapters = chaptersToRead?.length || 0;

    if (totalChapters === 0 || isNaN(totalReadingDays) || totalReadingDays <= 0) {
        console.warn("Input inválido ou 0 capítulos/dias para distributeChaptersOverReadingDays.");
        for (let i = 1; i <= Math.max(1, totalReadingDays); i++) {
            planMap[i.toString()] = [];
        }
        return planMap;
    }

    const baseChaptersPerReadingDay = Math.floor(totalChapters / totalReadingDays);
    let extraChapters = totalChapters % totalReadingDays;
    let chapterIndex = 0;

    for (let dayNumber = 1; dayNumber <= totalReadingDays; dayNumber++) {
        const chaptersForThisDayCount = baseChaptersPerReadingDay + (extraChapters > 0 ? 1 : 0);
        const endSliceIndex = Math.min(chapterIndex + chaptersForThisDayCount, totalChapters);
        const chaptersForThisDay = chaptersToRead.slice(chapterIndex, endSliceIndex);

        planMap[dayNumber.toString()] = chaptersForThisDay;

        chapterIndex = endSliceIndex;
        if (extraChapters > 0) {
            extraChapters--;
        }
    }

    if (chapterIndex < totalChapters) {
        console.warn("Nem todos os capítulos foram distribuídos. Adicionando restantes ao último dia.");
        const remaining = chaptersToRead.slice(chapterIndex);
        if (planMap[totalReadingDays.toString()]) {
             planMap[totalReadingDays.toString()].push(...remaining);
        } else {
             // If totalReadingDays was 0 or 1, assign to day 1
             if (!planMap["1"]) planMap["1"] = [];
             planMap["1"].push(...remaining);
        }
    }

    return planMap;
}

/** Atualiza as sugestões de livros no datalist enquanto o usuário digita */
function updateBookSuggestions() {
    if (!chaptersInput || !bookSuggestionsDatalist) return;
    const currentText = chaptersInput.value;
    const lastCommaIndex = currentText.lastIndexOf(',');
    const relevantText = (lastCommaIndex >= 0 ? currentText.substring(lastCommaIndex + 1) : currentText).trim().toLowerCase();

    bookSuggestionsDatalist.innerHTML = '';

    if (relevantText && !/^\d+\s*(-?\s*\d*)?$/.test(relevantText)) {
        const matchingBooks = canonicalBookOrder.filter(book => {
            const bookLower = book.toLowerCase();
            const bookLowerNoSpace = bookLower.replace(/\s+/g, '');
            return bookLower.startsWith(relevantText) || bookLowerNoSpace.startsWith(relevantText.replace(/\s+/g, ''));
        });

        const limit = 7;
        matchingBooks.slice(0, limit).forEach(book => {
            const option = document.createElement('option');
            const prefix = lastCommaIndex >= 0 ? currentText.substring(0, lastCommaIndex + 1) + ' ' : '';
            option.value = prefix + book + ' ';
            option.label = book;
            bookSuggestionsDatalist.appendChild(option);
        });
    }
}


// --- Funções de UI e Estado ---
function showLoading(indicatorDiv, show = true) { if (indicatorDiv) indicatorDiv.style.display = show ? 'block' : 'none'; }
function showErrorMessage(errorDiv, message) { if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = message ? 'block' : 'none'; } }
function toggleForms(showLogin = true) { if (loginForm && signupForm) { loginForm.style.display = showLogin ? 'block' : 'none'; signupForm.style.display = showLogin ? 'none' : 'block'; } showErrorMessage(authErrorDiv, ''); showErrorMessage(signupErrorDiv, ''); }

/** Atualiza o marcador semanal com base nas interações da semana atual, periodicidade e dias passados */
function updateWeeklyTrackerUI() {
    if (!weeklyTrackerContainer || !dayIndicatorElements) return;

    const currentWeekId = getUTCWeekId();
    const weekStartDate = getUTCWeekStartDate();
    const todayStr = getCurrentUTCDateString();

    // Determina os dias permitidos PELO PLANO ATIVO
    let effectiveAllowedDays = [0, 1, 2, 3, 4, 5, 6];
    let planIsActive = false;
    let planReadAheadDates = {}; // *** NOVO: Obter datas lidas adiantado

    if (currentReadingPlan && Array.isArray(currentReadingPlan.allowedDays)) {
        planIsActive = true;
        if (currentReadingPlan.allowedDays.length > 0) {
            effectiveAllowedDays = currentReadingPlan.allowedDays;
        }
        // *** NOVO: Garantir que readAheadDates é um objeto ***
        planReadAheadDates = currentReadingPlan.readAheadDates || {};
    }

    // Verifica se os dados de interação da semana são válidos
    const isCurrentWeekDataValid = currentWeeklyInteractions &&
                                   currentWeeklyInteractions.weekId === currentWeekId &&
                                   currentWeeklyInteractions.interactions &&
                                   typeof currentWeeklyInteractions.interactions === 'object'; // Permite objeto vazio

    dayIndicatorElements.forEach(el => {
        const dayIndex = parseInt(el.dataset.day, 10); // 0=Dom, 1=Seg, ...

        // Calcula a data para este dia do indicador
        const dateForThisDay = new Date(weekStartDate);
        dateForThisDay.setUTCDate(weekStartDate.getUTCDate() + dayIndex);
        const dateString = dateForThisDay.toISOString().split('T')[0];

        // Determina os estados possíveis
        const isPastDay = dateString < todayStr;
        const isToday = dateString === todayStr;
        const isAllowedByPlanSettings = planIsActive && effectiveAllowedDays.includes(dayIndex);
        const isMarkedReadOnThisDay = isCurrentWeekDataValid && currentWeeklyInteractions.interactions[dateString]; // Interação REAL neste dia
        const isMarkedReadAhead = planIsActive && planReadAheadDates[dateString]; // Marcado adiantado para esta data
        const isInactivePlanDay = planIsActive && !effectiveAllowedDays.includes(dayIndex);

        // *** Lógica de decisão do estado visual (com prioridade) ***
        // 1. Reseta classes de estado anteriores
        el.classList.remove('active', 'read-ahead-day', 'inactive-plan-day', 'missed-day');

        if (isMarkedReadOnThisDay) {
            // PRIORIDADE 1: Interação real neste dia (maior prioridade)
            el.classList.add('active');
        } else if (isMarkedReadAhead && !isPastDay && !isToday) {
             // *** NOVO: PRIORIDADE 2: Lido adiantado (só para dias futuros) ***
             el.classList.add('read-ahead-day');
        } else if (isInactivePlanDay) {
            // PRIORIDADE 3: Dia inativo conforme configurações do plano
            el.classList.add('inactive-plan-day');
        } else if (isPastDay && isAllowedByPlanSettings && planIsActive) {
            // PRIORIDADE 4: Dia passado, permitido, mas não marcado (nem real nem adiantado)
            el.classList.add('missed-day');
        }
        // else: Dia futuro permitido (ou sem plano ativo), ou dia passado sem plano ativo. Fica com estilo padrão.

    });

    // Exibe o container apenas se houver um plano ativo
    weeklyTrackerContainer.style.display = planIsActive ? 'block' : 'none';
}


/** Atualiza a interface com base no estado de autenticação */
function updateUIBasedOnAuthState(user) {
    currentUser = user;
    // Reset read ahead state on auth change
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    if (user) {
        authSection.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        userEmailSpan.textContent = user.email;
        userEmailSpan.style.display = 'inline';
        loadUserDataAndPlans().then(() => {
             updateStreakCounterUI();
        }); // Carrega dados do usuário, planos, o plano ativo e a sequência
    } else {
        userInfo = null;
        activePlanId = null;
        currentReadingPlan = null;
        userPlansList = [];
        currentWeeklyInteractions = { weekId: null, interactions: {} };
        userStreakData = { lastInteractionDate: null, current: 0, longest: 0 };

        authSection.style.display = 'block';
        planCreationSection.style.display = 'none';
        readingPlanSection.style.display = 'none';
        if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
        if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
        if (streakCounterSection) streakCounterSection.style.display = 'none';
        planSelectorContainer.style.display = 'none';
        logoutButton.style.display = 'none';
        userEmailSpan.style.display = 'none';
        userEmailSpan.textContent = '';

        resetFormFields();
        updateWeeklyTrackerUI();
        updateProgressBarUI();
        clearPlanListUI();
        clearHistoryUI();
        clearStatsUI();
        clearOverdueReadingsUI();
        clearUpcomingReadingsUI();
        toggleForms(true);
    }
    showLoading(authLoadingDiv, false);
}

/** Reseta os campos do formulário de criação de plano */
function resetFormFields() {
    if (planNameInput) planNameInput.value = "";
    if (googleDriveLinkInput) googleDriveLinkInput.value = "";
    if (startBookSelect) startBookSelect.value = "";
    if (startChapterInput) startChapterInput.value = "";
    if (endBookSelect) endBookSelect.value = "";
    if (endChapterInput) endChapterInput.value = "";
    if (booksSelect) Array.from(booksSelect.options).forEach(opt => opt.selected = false);
    if (chaptersInput) chaptersInput.value = "";
    if (daysInput) daysInput.value = "30";
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    if (chaptersPerDayInput) chaptersPerDayInput.value = '3';
    const intervalRadio = document.querySelector('input[name="creation-method"][value="interval"]');
    if (intervalRadio) intervalRadio.checked = true;
    const daysDurationRadio = document.querySelector('input[name="duration-method"][value="days"]');
    if (daysDurationRadio) daysDurationRadio.checked = true;
    if(periodicityCheckboxes) {
        periodicityCheckboxes.forEach(cb => {
            const dayVal = parseInt(cb.value);
            cb.checked = (dayVal >= 1 && dayVal <= 5); // Padrão Seg-Sex
        });
    }
    if (periodicityWarningDiv) showErrorMessage(periodicityWarningDiv, '');
    showErrorMessage(planErrorDiv, '');
    togglePlanCreationOptions();
}

/** Atualiza a barra de progresso com base no plano ativo */
function updateProgressBarUI() {
    if (!currentReadingPlan || !progressBarContainer || !progressBarFill || !progressText) {
        if (progressBarContainer) progressBarContainer.style.display = 'none';
        return;
    }

    const { plan, currentDay, startDate, endDate, name } = currentReadingPlan;
    const totalReadingDaysInPlan = Object.keys(plan || {}).length;
    const currentDayForCalc = currentDay || 0;

    let percentage = 0;
    let progressLabel = "Nenhum plano ativo.";

    if (totalReadingDaysInPlan > 0 && startDate && endDate) {
        progressBarContainer.style.display = 'block';
        const isCompleted = currentDayForCalc > totalReadingDaysInPlan;
        // Base progress on currentDay, not just logged days
        percentage = Math.min(100, Math.max(0, ((currentDayForCalc - 1) / totalReadingDaysInPlan) * 100));

        if (isCompleted) {
            percentage = 100;
            progressLabel = `Plano concluído! (${formatUTCDateStringToBrasilian(startDate)} - ${formatUTCDateStringToBrasilian(endDate)})`;
        } else {
            progressLabel = `Dia ${currentDayForCalc} de ${totalReadingDaysInPlan} (${Math.round(percentage)}%) | ${formatUTCDateStringToBrasilian(startDate)} - ${formatUTCDateStringToBrasilian(endDate)}`;
        }
        progressBarFill.style.width = percentage + '%';
        progressText.textContent = progressLabel;
    } else {
        progressBarContainer.style.display = 'none';
        progressText.textContent = `Plano "${name || 'Sem nome'}" inválido (sem dias/datas)`;
        console.warn("Progresso não pode ser calculado: plano inválido ou sem datas.", currentReadingPlan);
    }
}

/** Popula o seletor de planos no cabeçalho */
function populatePlanSelector() {
    if (!planSelect || !planSelectorContainer) return;
    planSelect.innerHTML = '';
    if (userPlansList.length === 0) {
        planSelect.innerHTML = '<option value="">Nenhum plano</option>';
        planSelectorContainer.style.display = 'flex';
        return;
    }

    userPlansList.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.id;
        const dateInfo = (plan.startDate && plan.endDate)
            ? ` (${formatUTCDateStringToBrasilian(plan.startDate)} a ${formatUTCDateStringToBrasilian(plan.endDate)})`
            : '';
        option.textContent = (plan.name || `Plano ${plan.id.substring(0, 5)}...`) + dateInfo;
        if (plan.id === activePlanId) {
            option.selected = true;
        }
        planSelect.appendChild(option);
    });
    planSelectorContainer.style.display = 'flex';
}

/** Popula o modal de gerenciamento de planos */
function populateManagePlansModal() {
    if (!planListDiv) return;
    showLoading(managePlansLoadingDiv, false);
    planListDiv.innerHTML = '';
    if (userPlansList.length === 0) {
        planListDiv.innerHTML = '<p>Você ainda não criou nenhum plano de leitura.</p>';
        return;
    }

    userPlansList.forEach(plan => {
        const item = document.createElement('div');
        item.classList.add('plan-list-item');
        const dateInfo = (plan.startDate && plan.endDate)
            ? `<small style="display: block; color: var(--text-color-muted); font-size: 0.8em;">${formatUTCDateStringToBrasilian(plan.startDate)} - ${formatUTCDateStringToBrasilian(plan.endDate)}</small>`
            : '<small style="display: block; color: red; font-size: 0.8em;">Datas não definidas</small>';

        const driveLinkHTML = plan.googleDriveLink
            ? `<a href="${plan.googleDriveLink}" target="_blank" class="manage-drive-link" title="Abrir link do Google Drive associado" onclick="event.stopPropagation();">
                   <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M7.71 5.41L5.77 7.35C4.09 9.03 3 11.36 3 13.95c0 3.31 2.69 6 6 6h1.05c.39 0 .76-.23.92-.59l2.12-4.72c.19-.43.02-.93-.4-1.16L8.8 11.5c-.57-.31-1.3-.17-1.7.4L5.82 14H6c-1.1 0-2-.9-2-2 0-1.84.8-3.5 2.1-4.59zM18 9h-1.05c-.39 0-.76.23-.92.59l-2.12 4.72c-.19.43-.02.93.4 1.16l3.89 1.98c.57.31 1.3.17 1.7-.4l1.28-2.05H18c1.1 0 2 .9 2 2 0 1.84-.8 3.5-2.1 4.59L18.29 18.59l1.94 1.94C21.91 18.97 23 16.64 23 14.05c0-3.31-2.69-6-6-6zM12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill-rule="evenodd"/></svg>
               </a>`
            : '';

        item.innerHTML = `
            <div>
                <span>${plan.name || `Plano ${plan.id.substring(0,5)}...`}</span>
                ${dateInfo}
            </div>
            <div class="actions">
                ${driveLinkHTML}
                <button class="button-primary activate-plan-btn" data-plan-id="${plan.id}" ${plan.id === activePlanId ? 'disabled' : ''}>
                    ${plan.id === activePlanId ? 'Ativo' : 'Ativar'}
                </button>
                <button class="button-danger delete-plan-btn" data-plan-id="${plan.id}">Excluir</button>
            </div>
        `;
        planListDiv.appendChild(item);
    });

    // Re-atribui listeners
    planListDiv.querySelectorAll('.activate-plan-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const planIdToActivate = e.target.dataset.planId;
            if (planIdToActivate && planIdToActivate !== activePlanId) {
                await setActivePlan(planIdToActivate);
                closeModal('manage-plans-modal');
            }
        });
    });
    planListDiv.querySelectorAll('.delete-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const planIdToDelete = e.target.dataset.planId;
            handleDeleteSpecificPlan(planIdToDelete);
        });
    });
}

/** Limpa a lista de planos na UI (Modal e Header) */
function clearPlanListUI() {
    if(planListDiv) planListDiv.innerHTML = '<p>Nenhum plano encontrado.</p>';
    if(planSelect) planSelect.innerHTML = '<option value="">Nenhum plano</option>';
}

/** Limpa o conteúdo do modal de histórico */
function clearHistoryUI() {
    if(historyListDiv) historyListDiv.innerHTML = '<p>Nenhum histórico registrado.</p>';
}

/** Limpa o conteúdo do modal de estatísticas */
function clearStatsUI() {
    if(statsActivePlanName) statsActivePlanName.textContent = '--';
    if(statsActivePlanProgress) statsActivePlanProgress.textContent = '--';
    if(statsTotalChapters) statsTotalChapters.textContent = '--';
    if(statsPlansCompleted) statsPlansCompleted.textContent = '--';
    if(statsAvgPace) statsAvgPace.textContent = '--';
    if(statsContentDiv) statsContentDiv.style.display = 'block';
    if(statsErrorDiv) showErrorMessage(statsErrorDiv, '');
}

/** Limpa a área de próximas leituras */
function clearUpcomingReadingsUI() {
    if (upcomingReadingsListDiv) upcomingReadingsListDiv.innerHTML = '<p>Carregando...</p>';
    if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
}

/** Limpa a área de leituras atrasadas */
function clearOverdueReadingsUI() {
    if (overdueReadingsListDiv) overdueReadingsListDiv.innerHTML = '<p>Carregando...</p>';
    if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
}

// --- Funções do Firebase ---

/** Busca (ou cria) informações do usuário no Firestore */
async function fetchUserInfo(userId) {
    const userDocRef = doc(db, 'users', userId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            userInfo = docSnap.data();
            activePlanId = userInfo.activePlanId || null;

            userStreakData = {
                lastInteractionDate: userInfo.lastStreakInteractionDate || null,
                current: userInfo.currentStreak || 0,
                longest: userInfo.longestStreak || 0
            };

            return userInfo;
        } else {
            const initialUserInfo = {
                email: currentUser.email,
                createdAt: serverTimestamp(),
                activePlanId: null,
                lastStreakInteractionDate: null,
                currentStreak: 0,
                longestStreak: 0
            };
            await setDoc(userDocRef, initialUserInfo);
            userInfo = initialUserInfo;
            activePlanId = null;
            userStreakData = { lastInteractionDate: null, current: 0, longest: 0 };
            return userInfo;
        }
    } catch (error) {
        console.error("Error fetching/creating user info:", error);
        showErrorMessage(authErrorDiv, `Erro ao carregar dados do usuário: ${error.message}`);
        userStreakData = { lastInteractionDate: null, current: 0, longest: 0 };
        return null;
    }
}

/** Busca a lista de planos do usuário no Firestore */
async function fetchUserPlansList(userId) {
    const plansCollectionRef = collection(db, 'users', userId, 'plans');
    const q = query(plansCollectionRef, orderBy("createdAt", "desc"));
    userPlansList = [];
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
            const planData = docSnap.data();
            // *** NOVO: Garantir que readAheadDates existe ao carregar ***
            if (!planData.readAheadDates) {
                planData.readAheadDates = {};
            }
             if (!planData.readLog) { // Garante que readLog existe
                planData.readLog = {};
            }
             if (!planData.weeklyInteractions) { // Garante que weeklyInteractions existe
                planData.weeklyInteractions = { weekId: getUTCWeekId(), interactions: {} };
            }
            userPlansList.push({ id: docSnap.id, ...planData });
        });
        return userPlansList;
    } catch (error) {
        console.error("Error fetching user plans list:", error);
        showErrorMessage(planViewErrorDiv, `Erro ao carregar lista de planos: ${error.message}`);
        return [];
    }
}

/** Carrega os dados do plano atualmente ativo */
async function loadActivePlanData(userId, planId) {
    // Reset read ahead state when loading a plan
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    if (!userId || !planId) {
        currentReadingPlan = null;
        currentWeeklyInteractions = { weekId: getUTCWeekId(), interactions: {} };
        readingPlanSection.style.display = 'none';
        if(progressBarContainer) progressBarContainer.style.display = 'none';
        planCreationSection.style.display = userPlansList.length === 0 ? 'block' : 'none';
        updateWeeklyTrackerUI();
        updateProgressBarUI();
        showLoading(planLoadingViewDiv, false);
        return;
    }

    showLoading(planLoadingViewDiv, true);
    showErrorMessage(planViewErrorDiv, '');
    planCreationSection.style.display = 'none';
    readingPlanSection.style.display = 'none';

    const planDocRef = doc(db, 'users', userId, 'plans', planId);
    try {
        const docSnap = await getDoc(planDocRef);
        const currentWeekId = getUTCWeekId();

        if (docSnap.exists()) {
            const data = docSnap.data();

            const mandatoryFieldsValid = data &&
                                       typeof data.plan === 'object' && !Array.isArray(data.plan) && data.plan !== null &&
                                       typeof data.currentDay === 'number' &&
                                       Array.isArray(data.chaptersList) &&
                                       typeof data.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) &&
                                       typeof data.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.endDate) &&
                                       Array.isArray(data.allowedDays);

            const recalcFieldsValid = (!data.recalculationBaseDay || typeof data.recalculationBaseDay === 'number') &&
                                     (!data.recalculationBaseDate || (typeof data.recalculationBaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.recalculationBaseDate)));

            if (!mandatoryFieldsValid || !recalcFieldsValid) {
                console.error("Invalid plan data format loaded:", data);
                currentReadingPlan = null;
                activePlanId = null;
                if(userInfo) await updateDoc(doc(db, 'users', userId), { activePlanId: null });
                throw new Error("Formato de dados do plano ativo é inválido. Plano desativado.");
            }

            // *** NOVO: Garantir que readAheadDates, readLog, weeklyInteractions existem ***
            if (!data.readAheadDates) data.readAheadDates = {};
            if (!data.readLog) data.readLog = {};
            if (!data.weeklyInteractions) data.weeklyInteractions = { weekId: currentWeekId, interactions: {} };

            currentReadingPlan = { id: planId, ...data };

            if (data.weeklyInteractions && data.weeklyInteractions.weekId === currentWeekId) {
                currentWeeklyInteractions = data.weeklyInteractions;
            } else {
                // If week is different, reset interactions but keep the weekId
                currentWeeklyInteractions = { weekId: currentWeekId, interactions: {} };
                 // Persist the reset weekly interactions if the week changed
                 try {
                     await updateDoc(planDocRef, { weeklyInteractions: currentWeeklyInteractions });
                     console.log(`Reset weekly interactions for plan ${planId} due to week change.`);
                 } catch (updateError) {
                     console.error("Error resetting weekly interactions on load:", updateError);
                 }
            }

            loadDailyReadingUI();
            updateWeeklyTrackerUI();
            updateProgressBarUI();
            readingPlanSection.style.display = 'block';
            planCreationSection.style.display = 'none';

        } else {
            console.warn("Active plan document (", planId, ") not found in Firestore.");
            currentReadingPlan = null;
            currentWeeklyInteractions = { weekId: currentWeekId, interactions: {} };
            if(userInfo && userInfo.activePlanId === planId) {
                await updateDoc(doc(db, 'users', userId), { activePlanId: null });
                activePlanId = null;
            }
            readingPlanSection.style.display = 'none';
            planCreationSection.style.display = userPlansList.length === 0 ? 'block' : 'none';
            updateWeeklyTrackerUI();
            updateProgressBarUI();
            populatePlanSelector();
        }
    } catch (error) {
        console.error("Error loading active plan data:", error);
        showErrorMessage(planViewErrorDiv, `Erro ao carregar plano ativo: ${error.message}`);
        currentReadingPlan = null;
        currentWeeklyInteractions = { weekId: getUTCWeekId(), interactions: {} };
        readingPlanSection.style.display = 'none';
        planCreationSection.style.display = userPlansList.length === 0 ? 'block' : 'none';
        updateWeeklyTrackerUI();
        updateProgressBarUI();
    } finally {
        showLoading(planLoadingViewDiv, false);
        // Ensure button is re-enabled after loading attempt, unless plan is completed
        if (markAsReadButton && !(currentReadingPlan && currentReadingPlan.currentDay > Object.keys(currentReadingPlan.plan || {}).length)) {
             markAsReadButton.disabled = false;
        } else if (markAsReadButton) {
            markAsReadButton.disabled = true; // Explicitly disable if completed
        }
    }
}


/** Carrega todos os dados iniciais do usuário (info, lista de planos, plano ativo, leituras agendadas, sequência) */
async function loadUserDataAndPlans() {
    if (!currentUser) return;
    const userId = currentUser.uid;

    showLoading(planLoadingViewDiv, true);
    readingPlanSection.style.display = 'none';
    planCreationSection.style.display = 'none';
    if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
    if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
    if (streakCounterSection) streakCounterSection.style.display = 'none';
    showErrorMessage(planViewErrorDiv, '');

    try {
        await fetchUserInfo(userId);
        await fetchUserPlansList(userId);
        populatePlanSelector();
        await loadActivePlanData(userId, activePlanId); // This now resets read ahead state
        await displayScheduledReadings();

    } catch (error) {
        console.error("Error during initial data load sequence:", error);
        readingPlanSection.style.display = 'none';
        planCreationSection.style.display = 'block';
        if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
        if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
        if (streakCounterSection) streakCounterSection.style.display = 'none';
    } finally {
        showLoading(planLoadingViewDiv, false);
    }
}

/** Define um plano como ativo no perfil do usuário e recarrega os dados */
async function setActivePlan(planId) {
    if (!currentUser || !planId) return;
    const userId = currentUser.uid;
    const userDocRef = doc(db, 'users', userId);
    if(planSelect) planSelect.disabled = true;

    // Reset read ahead state when switching plans
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    try {
        await updateDoc(userDocRef, { activePlanId: planId });
        activePlanId = planId;
        if (userInfo) userInfo.activePlanId = planId;
        if (planSelect) planSelect.value = planId;

        await loadActivePlanData(userId, planId); // This now resets read ahead state
        await displayScheduledReadings();

        if (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') {
            populateManagePlansModal(); // Update modal if open
        }
    } catch (error) {
        console.error("Error setting active plan:", error);
        showErrorMessage(planViewErrorDiv, `Erro ao ativar plano: ${error.message}`);
        if (planSelect && currentReadingPlan) planSelect.value = currentReadingPlan.id;
        else if (planSelect) planSelect.value = '';
    } finally {
        if(planSelect) planSelect.disabled = false;
    }
}

/** Salva um novo plano no Firestore */
async function saveNewPlanToFirestore(userId, planData) {
    if (!userId) { showErrorMessage(planErrorDiv, "Erro: Usuário não autenticado."); return null; }

    showLoading(planLoadingCreateDiv, true);
    if (createPlanButton) createPlanButton.disabled = true;
    if (cancelCreationButton) cancelCreationButton.disabled = true;

    const plansCollectionRef = collection(db, 'users', userId, 'plans');

    try {
        if(typeof planData.plan !== 'object' || Array.isArray(planData.plan) || planData.plan === null) throw new Error("Formato interno do plano inválido.");
        if (!planData.name || planData.name.trim() === '') throw new Error("O nome do plano é obrigatório.");
        if (!planData.startDate || !planData.endDate) throw new Error("Datas de início e/ou fim não foram definidas para o plano.");
        if (!Array.isArray(planData.allowedDays)) throw new Error("Dias de leitura permitidos inválidos.");
        if (typeof planData.currentDay !== 'number' || planData.currentDay < 1) throw new Error("Dia inicial do plano inválido.");
        if (!Array.isArray(planData.chaptersList)) throw new Error("Lista de capítulos inválida.");
        if (typeof planData.totalChapters !== 'number') throw new Error("Total de capítulos inválido.");

        const currentWeekId = getUTCWeekId();
        const dataToSave = {
            ...planData,
            readLog: {}, // Initialize readLog
            readAheadDates: {}, // *** NOVO: Initialize readAheadDates ***
            weeklyInteractions: { weekId: currentWeekId, interactions: {} },
            createdAt: serverTimestamp(),
            recalculationBaseDay: null,
            recalculationBaseDate: null
        };

        const newPlanDocRef = await addDoc(plansCollectionRef, dataToSave);
        // Add the new plan with initial empty objects locally
        userPlansList.unshift({ id: newPlanDocRef.id, ...dataToSave });
        await setActivePlan(newPlanDocRef.id); // This will reload the plan correctly
        return newPlanDocRef.id;

    } catch (error) {
        console.error("Error saving new plan to Firestore:", error);
        showErrorMessage(planErrorDiv, `Erro ao salvar plano: ${error.message}`);
        return null;
    } finally {
        showLoading(planLoadingCreateDiv, false);
        if (createPlanButton) createPlanButton.disabled = false;
        if (cancelCreationButton) cancelCreationButton.disabled = false;
    }
}

/**
 * Atualiza o progresso no Firestore.
 * @param {string} userId ID do usuário.
 * @param {string} planId ID do plano.
 * @param {number} newDay O novo currentDay.
 * @param {object} updatedWeeklyInteractions O objeto weeklyInteractions atualizado.
 * @param {object|null} logEntry Opcional: entrada para readLog ( { date: 'YYYY-MM-DD', chapters: [...] } ).
 * @param {object|null} readAheadUpdate Opcional: atualização para readAheadDates ( { 'YYYY-MM-DD': true } ).
 * @returns {boolean} True se sucesso, false se falha.
 */
async function updateProgressInFirestore(userId, planId, newDay, updatedWeeklyInteractions, logEntry = null, readAheadUpdate = null) {
    if (!userId || !planId) {
        console.error("Erro ao atualizar progresso: Usuário ou ID do plano inválido.");
        showErrorMessage(planViewErrorDiv, "Erro crítico ao salvar progresso. Recarregue.");
        return false;
    }
    // Remove any pending timeout if progress is updated
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;
    isReadAheadPossible = false;

    const planDocRef = doc(db, 'users', userId, 'plans', planId);

    try {
        const dataToUpdate = {
            currentDay: newDay,
            weeklyInteractions: updatedWeeklyInteractions
        };

        // Handle log entry
        if (logEntry && logEntry.date && /^\d{4}-\d{2}-\d{2}$/.test(logEntry.date) && Array.isArray(logEntry.chapters)) {
            dataToUpdate[`readLog.${logEntry.date}`] = logEntry.chapters;
        } else if (logEntry) {
            console.warn("Log entry provided but invalid, not saving log.", logEntry);
        }

        // *** NOVO: Handle readAheadDates update ***
        if (readAheadUpdate && typeof readAheadUpdate === 'object' && Object.keys(readAheadUpdate).length === 1) {
            const dateKey = Object.keys(readAheadUpdate)[0];
            const value = Object.values(readAheadUpdate)[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof value === 'boolean') {
                dataToUpdate[`readAheadDates.${dateKey}`] = value; // Use dot notation for nested map update
            } else {
                console.warn("Read ahead update provided but invalid, not saving.", readAheadUpdate);
            }
        } else if (readAheadUpdate) {
             console.warn("Read ahead update provided but invalid format, not saving.", readAheadUpdate);
        }
        // console.log("Data to update in Firestore:", dataToUpdate); // Debug log

        await updateDoc(planDocRef, dataToUpdate);

        // Atualiza estado local do PLANO (importante fazer DEPOIS do Firestore)
        if (currentReadingPlan && currentReadingPlan.id === planId) {
            currentReadingPlan.currentDay = newDay;
            currentWeeklyInteractions = updatedWeeklyInteractions; // Update global weekly interactions

            if (logEntry && logEntry.date && Array.isArray(logEntry.chapters)) {
                if (!currentReadingPlan.readLog) currentReadingPlan.readLog = {};
                currentReadingPlan.readLog[logEntry.date] = logEntry.chapters;
            }
             // *** NOVO: Atualiza readAheadDates local ***
             if (readAheadUpdate && typeof readAheadUpdate === 'object' && Object.keys(readAheadUpdate).length === 1) {
                const dateKey = Object.keys(readAheadUpdate)[0];
                const value = Object.values(readAheadUpdate)[0];
                 if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof value === 'boolean') {
                    if (!currentReadingPlan.readAheadDates) currentReadingPlan.readAheadDates = {};
                    currentReadingPlan.readAheadDates[dateKey] = value;
                 }
             }
        } else {
             console.warn("Firestore updated, but local 'currentReadingPlan' doesn't match. State might be inconsistent.");
             // Optionally, force a reload if this happens often
             // await loadActivePlanData(userId, planId);
        }
        return true;

    } catch (error) {
        console.error("Error updating progress in Firestore:", error);
        showErrorMessage(planViewErrorDiv, `Erro ao salvar progresso do plano: ${error.message}. Tente novamente.`);
        return false;
    }
}

/** Salva os dados de um plano recalculado no Firestore (sobrescreve o documento) */
async function saveRecalculatedPlanToFirestore(userId, planId, updatedPlanData) {
    if (!userId || !planId) { showErrorMessage(recalculateErrorDiv, "Erro: Usuário ou plano ativo inválido."); return false; }

    // Reset read ahead state on recalculation
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    showLoading(recalculateLoadingDiv, true);
    if (confirmRecalculateButton) confirmRecalculateButton.disabled = true;
    const planDocRef = doc(db, 'users', userId, 'plans', planId);

    try {
        if(typeof updatedPlanData.plan !== 'object' || Array.isArray(updatedPlanData.plan) || updatedPlanData.plan === null) throw new Error("Formato interno do plano recalculado inválido.");
        if(!updatedPlanData.startDate || !updatedPlanData.endDate) throw new Error("Datas de início/fim ausentes no plano recalculado.");
        if(typeof updatedPlanData.currentDay !== 'number') throw new Error("Dia atual ausente ou inválido no plano recalculado.");
        if(typeof updatedPlanData.recalculationBaseDay !== 'number') throw new Error("Dia base do recálculo inválido.");
        if(typeof updatedPlanData.recalculationBaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updatedPlanData.recalculationBaseDate)) throw new Error("Data base do recálculo inválida.");

        // *** NOVO: Ensure readAheadDates is cleared on recalculation save ***
        const dataToSave = {
            ...updatedPlanData,
            readAheadDates: {} // Explicitly reset readAheadDates
        };

        await setDoc(planDocRef, dataToSave); // Use setDoc to overwrite completely

        // Update local state
        currentReadingPlan = { id: planId, ...dataToSave }; // Use the saved data with cleared readAheadDates
        const index = userPlansList.findIndex(p => p.id === planId);
        if (index > -1) {
            userPlansList[index] = { id: planId, ...dataToSave };
        }

        return true;

    } catch (error) {
        console.error("Error saving recalculated plan:", error);
        showErrorMessage(recalculateErrorDiv, `Erro ao salvar recálculo: ${error.message}`);
        return false;
    } finally {
        showLoading(recalculateLoadingDiv, false);
        if (confirmRecalculateButton) confirmRecalculateButton.disabled = false;
    }
}

/** Deleta um plano específico do Firestore e atualiza o estado local */
async function deletePlanFromFirestore(userId, planIdToDelete) {
    if (!userId || !planIdToDelete) {
        console.error("Erro ao deletar: Usuário ou ID do plano inválido.");
        return false;
    }

    const planDocRef = doc(db, 'users', userId, 'plans', planIdToDelete);
    const userDocRef = doc(db, 'users', userId);

    try {
        await deleteDoc(planDocRef);
        userPlansList = userPlansList.filter(p => p.id !== planIdToDelete);

        // Reset read ahead state if the deleted plan was active
        if (activePlanId === planIdToDelete) {
            isReadAheadPossible = false;
            if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
            readAheadTimeoutId = null;

            activePlanId = null;
            currentReadingPlan = null;
            currentWeeklyInteractions = { weekId: getUTCWeekId(), interactions: {} };

            const nextActivePlanId = userPlansList.length > 0 ? userPlansList[0].id : null;
            await updateDoc(userDocRef, { activePlanId: nextActivePlanId });
            activePlanId = nextActivePlanId;

            populatePlanSelector();
            await loadActivePlanData(userId, activePlanId); // Load next plan (will reset read ahead state again)
            await displayScheduledReadings();

        } else {
            // If deleted plan wasn't active, just update lists
            populatePlanSelector();
             if (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') {
                populateManagePlansModal();
            }
            // No need to reload active plan, but refresh scheduled readings as they might change
            await displayScheduledReadings();
        }

        return true;

    } catch (error) {
        console.error("Error deleting plan from Firestore:", error);
        const errorTargetDiv = (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') ? managePlansErrorDiv : planViewErrorDiv;
        showErrorMessage(errorTargetDiv, `Erro ao deletar plano: ${error.message}`);
        return false;
    }
}


// --- Funções Principais de Interação ---

/** Alterna a visibilidade das opções de criação de plano com base nas seleções */
function togglePlanCreationOptions() {
    const creationMethodRadio = document.querySelector('input[name="creation-method"]:checked');
    const durationMethodRadio = document.querySelector('input[name="duration-method"]:checked');

    const creationMethod = creationMethodRadio ? creationMethodRadio.value : 'interval';
    const durationMethod = durationMethodRadio ? durationMethodRadio.value : 'days';

    if (intervalOptionsDiv) intervalOptionsDiv.style.display = creationMethod === 'interval' ? 'block' : 'none';
    if (selectionOptionsDiv) selectionOptionsDiv.style.display = (creationMethod === 'selection' || creationMethod === 'chapters-per-day') ? 'block' : 'none';

    const showDaysOption = durationMethod === 'days' && creationMethod !== 'chapters-per-day';
    const showEndDateOption = durationMethod === 'end-date' && creationMethod !== 'chapters-per-day';
    const showChaptersPerDayOption = creationMethod === 'chapters-per-day';

    if (daysOptionDiv) daysOptionDiv.style.display = showDaysOption ? 'block' : 'none';
    if (endDateOptionDiv) endDateOptionDiv.style.display = showEndDateOption ? 'block' : 'none';
    if (chaptersPerDayOptionDiv) chaptersPerDayOptionDiv.style.display = showChaptersPerDayOption ? 'block' : 'none';

    if (daysInput) daysInput.disabled = !showDaysOption;
    if (startDateInput) startDateInput.disabled = !showEndDateOption;
    if (endDateInput) endDateInput.disabled = !showEndDateOption;
    if (chaptersPerDayInput) chaptersPerDayInput.disabled = !showChaptersPerDayOption;

    if (durationMethodRadios) {
        durationMethodRadios.forEach(r => r.disabled = showChaptersPerDayOption);
    }
    if (showChaptersPerDayOption) {
        if (daysOptionDiv) daysOptionDiv.style.display = 'none';
        if (endDateOptionDiv) endDateOptionDiv.style.display = 'none';
    }
    if (showEndDateOption && startDateInput && !startDateInput.value) {
        try {
            const todayLocal = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
            startDateInput.value = todayLocal.toISOString().split('T')[0];
        } catch (e) { console.error("Erro ao definir data inicial padrão:", e); }
    }
}

/** Mostra a seção de criação de plano, resetando os campos */
function showPlanCreationSection() {
    // Reset read ahead state when showing creation section
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    resetFormFields();
    readingPlanSection.style.display = 'none';
    if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
    if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
    if (streakCounterSection) streakCounterSection.style.display = 'none';
    planCreationSection.style.display = 'block';
    if (cancelCreationButton) {
        cancelCreationButton.style.display = userPlansList.length > 0 ? 'inline-block' : 'none';
    }
    window.scrollTo(0, 0);
}

/** Cancela a criação do plano e volta para a visualização do plano ativo (se houver) */
function cancelPlanCreation() {
    planCreationSection.style.display = 'none';
    showErrorMessage(planErrorDiv, '');

    if (currentReadingPlan && activePlanId) {
        readingPlanSection.style.display = 'block';
        if (streakCounterSection) streakCounterSection.style.display = 'flex';
        if (overdueReadingsSection) overdueReadingsSection.style.display = overdueReadingsListDiv.children.length > 0 && !overdueReadingsListDiv.querySelector('p') ? 'block' : 'none';
        if (upcomingReadingsSection) upcomingReadingsSection.style.display = upcomingReadingsListDiv.children.length > 0 && !upcomingReadingsListDiv.querySelector('p') ? 'block' : 'none';
    } else {
        console.log("Cancel creation: No active plan to return to.");
        if (currentUser && streakCounterSection) streakCounterSection.style.display = 'flex';
        displayScheduledReadings(); // Show scheduled readings even if no plan is active
    }
}

/** Cria um novo plano de leitura com base nos dados do formulário */
async function createReadingPlan() {
    if (!currentUser) { alert("Você precisa estar logado para criar um plano."); return; }
    const userId = currentUser.uid;

    showErrorMessage(planErrorDiv, '');
    showErrorMessage(periodicityWarningDiv, '');

    const planName = planNameInput.value.trim();
    const googleDriveLink = googleDriveLinkInput.value.trim();

    if (!planName) { showErrorMessage(planErrorDiv, "Por favor, dê um nome ao seu plano."); planNameInput.focus(); return; }
    if (googleDriveLink && !(googleDriveLink.startsWith('http://') || googleDriveLink.startsWith('https://'))) {
        showErrorMessage(planErrorDiv, "O link do Google Drive parece inválido. Use o endereço completo (http:// ou https://).");
        googleDriveLinkInput.focus();
        return;
    }
    const allowedDaysOfWeek = Array.from(periodicityCheckboxes)
                               .filter(cb => cb.checked)
                               .map(cb => parseInt(cb.value, 10));
    const validAllowedDaysForCalculation = allowedDaysOfWeek.length > 0 ? allowedDaysOfWeek : [0, 1, 2, 3, 4, 5, 6];


    let chaptersToRead = [];

    try {
        const creationMethodRadio = document.querySelector('input[name="creation-method"]:checked');
        const creationMethod = creationMethodRadio ? creationMethodRadio.value : null;
        if (!creationMethod) throw new Error("Método de criação não selecionado.");

        if (creationMethod === 'interval') {
            const startBook = startBookSelect.value;
            const startChap = parseInt(startChapterInput.value, 10);
            const endBook = endBookSelect.value;
            const endChap = parseInt(endChapterInput.value, 10);
            if (!startBook || isNaN(startChap) || !endBook || isNaN(endChap)) { throw new Error("Selecione os livros e capítulos inicial/final corretamente."); }
            const generatedChapters = generateChaptersInRange(startBook, startChap, endBook, endChap);
            if (generatedChapters === null) return; // Error message handled by generateChaptersInRange
            chaptersToRead = generatedChapters;

        } else if (creationMethod === 'selection' || creationMethod === 'chapters-per-day') {
            const selectedBooks = booksSelect ? Array.from(booksSelect.selectedOptions).map(opt => opt.value) : [];
            const chaptersText = chaptersInput ? chaptersInput.value.trim() : "";
            if (selectedBooks.length === 0 && !chaptersText) { throw new Error("Escolha livros na lista OU digite capítulos/intervalos."); }
            let chaptersFromSelectedBooks = [];
            selectedBooks.forEach(book => {
                if (!bibleBooksChapters[book]) return;
                const maxChap = bibleBooksChapters[book];
                for (let i = 1; i <= maxChap; i++) chaptersFromSelectedBooks.push(`${book} ${i}`);
            });
            let chaptersFromTextInput = parseChaptersInput(chaptersText);
            const combinedSet = new Set([...chaptersFromSelectedBooks, ...chaptersFromTextInput]);
            const combinedChapters = Array.from(combinedSet);
            combinedChapters.sort((a, b) => {
                const matchA = a.match(/^(.*)\s+(\d+)$/); const matchB = b.match(/^(.*)\s+(\d+)$/);
                if (!matchA || !matchB) return 0;
                const bookA = matchA[1]; const chapA = parseInt(matchA[2], 10);
                const bookB = matchB[1]; const chapB = parseInt(matchB[2], 10);
                const indexA = canonicalBookOrder.indexOf(bookA); const indexB = canonicalBookOrder.indexOf(bookB);
                if (indexA === -1 || indexB === -1) return 0;
                if (indexA !== indexB) return indexA - indexB; return chapA - chapB;
            });
            chaptersToRead = combinedChapters;
        }

        if (!chaptersToRead || chaptersToRead.length === 0) { throw new Error("Nenhum capítulo válido foi selecionado ou gerado para o plano."); }

        let startDateStr = getCurrentUTCDateString();
        let totalReadingDays = 0;
        let planMap = {};
        let endDateStr = '';
        const durationMethodRadio = document.querySelector('input[name="duration-method"]:checked');
        const durationMethod = (creationMethod === 'chapters-per-day') ? null : (durationMethodRadio ? durationMethodRadio.value : 'days');

        if (creationMethod === 'chapters-per-day') {
            const chapPerDay = parseInt(chaptersPerDayInput.value, 10);
            if (isNaN(chapPerDay) || chapPerDay <= 0) throw new Error("Número inválido de capítulos por dia de leitura.");
            totalReadingDays = Math.ceil(chaptersToRead.length / chapPerDay);
            if (totalReadingDays < 1) totalReadingDays = 1;
            planMap = distributeChaptersOverReadingDays(chaptersToRead, totalReadingDays);

        } else if (durationMethod === 'days') {
            const totalCalendarDaysInput = parseInt(daysInput.value, 10);
            if (isNaN(totalCalendarDaysInput) || totalCalendarDaysInput <= 0) throw new Error("Número total de dias de calendário inválido.");
            let readingDaysInPeriod = 0;
            let tempDate = new Date(startDateStr + 'T00:00:00Z');
            for (let i = 0; i < totalCalendarDaysInput; i++) {
                if (validAllowedDaysForCalculation.includes(tempDate.getUTCDay())) { readingDaysInPeriod++; }
                tempDate.setUTCDate(tempDate.getUTCDate() + 1);
                 if (i > 365*10) { console.warn("Loop break: calculating reading days in period (days)."); break; }
            }
            totalReadingDays = Math.max(1, readingDaysInPeriod);
            planMap = distributeChaptersOverReadingDays(chaptersToRead, totalReadingDays);

        } else if (durationMethod === 'end-date') {
            const inputStartDateStr = startDateInput.value || startDateStr;
            const inputEndDateStr = endDateInput.value;
            if (!inputEndDateStr) throw new Error("Selecione a data final.");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(inputStartDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(inputEndDateStr)) throw new Error("Formato de data inválido (use YYYY-MM-DD).");
            const start = new Date(inputStartDateStr + 'T00:00:00Z');
            const end = new Date(inputEndDateStr + 'T00:00:00Z');
            if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Datas inválidas.");
            if (end < start) throw new Error("A data final não pode ser anterior à data inicial.");

            startDateStr = inputStartDateStr;
            const calendarDuration = dateDiffInDays(inputStartDateStr, inputEndDateStr) + 1;
            let readingDaysInPeriod = 0;
            let tempDate = new Date(start);
            for (let i = 0; i < calendarDuration; i++) {
                if (validAllowedDaysForCalculation.includes(tempDate.getUTCDay())) { readingDaysInPeriod++; }
                tempDate.setUTCDate(tempDate.getUTCDate() + 1);
                if (i > 365*10) { console.warn("Loop break: calculating reading days in period (end-date)."); break; }
            }
            totalReadingDays = Math.max(1, readingDaysInPeriod);
            planMap = distributeChaptersOverReadingDays(chaptersToRead, totalReadingDays);
        } else {
             if(creationMethod !== 'chapters-per-day') { throw new Error("Método de duração inválido ou não determinado."); }
        }

        // Recalculate endDateStr based on the FINAL totalReadingDays and startDateStr
        endDateStr = calculateDateForDay(startDateStr, totalReadingDays, allowedDaysOfWeek);

        // Warning if no reading days were found in the period but chapters exist
        if (totalReadingDays === 0 && chaptersToRead.length > 0 && endDateStr === null) {
             showErrorMessage(periodicityWarningDiv, "Aviso: O período definido não contém nenhum dos dias selecionados para leitura. O plano será criado, mas pode não ter leituras agendadas ou uma data final válida. Considere aumentar o período ou ajustar os dias da semana.");
             // Try calculating end date assuming all days are allowed, just to have *some* end date
             endDateStr = calculateDateForDay(startDateStr, totalReadingDays, [0,1,2,3,4,5,6]);
             if (!endDateStr) {
                  // Fallback if even that fails (e.g., totalReadingDays somehow became invalid)
                   const fallbackEndDate = addUTCDays(new Date(startDateStr + 'T00:00:00Z'), 30); // Add 30 days as arbitrary fallback
                   endDateStr = fallbackEndDate.toISOString().split('T')[0];
                   console.warn("Critical failure calculating end date, using fallback: ", endDateStr);
             }
        } else if (endDateStr === null) {
             throw new Error(`Não foi possível calcular a data final do plano com ${totalReadingDays} dias de leitura a partir de ${startDateStr}. Verifique os dias da semana ou o período.`);
        }


        const newPlanData = {
            name: planName,
            plan: planMap,
            currentDay: 1,
            totalChapters: chaptersToRead.length,
            chaptersList: chaptersToRead,
            allowedDays: allowedDaysOfWeek,
            startDate: startDateStr,
            endDate: endDateStr,
            // Initial empty states handled by saveNewPlanToFirestore
            googleDriveLink: googleDriveLink || null,
            // Recalc base handled by saveNewPlanToFirestore
        };

        const newPlanId = await saveNewPlanToFirestore(userId, newPlanData);
        if (newPlanId) {
            alert(`Plano "${planName}" criado com sucesso! Iniciando em ${formatUTCDateStringToBrasilian(startDateStr)} e terminando em ${formatUTCDateStringToBrasilian(endDateStr)}.`);
            // UI will be updated by setActivePlan called within saveNewPlanToFirestore
        }

    } catch (error) {
        console.error("Erro durante createReadingPlan:", error);
        showErrorMessage(planErrorDiv, `Erro ao criar plano: ${error.message}`);
    }
}


/** Atualiza a UI para mostrar a leitura do dia atual (com data e link) */
function loadDailyReadingUI() {
    if (!dailyReadingDiv || !markAsReadButton || !recalculatePlanButton || !deleteCurrentPlanButton || !readingPlanTitle || !activePlanDriveLink || !readingPlanSection || !planCreationSection) {
        console.warn("Elementos da UI do plano ou de criação não encontrados em loadDailyReadingUI.");
        if(readingPlanSection) readingPlanSection.style.display = 'none';
        if(planCreationSection) planCreationSection.style.display = 'none';
        if(progressBarContainer) progressBarContainer.style.display = 'none';
        return;
    }

    updateProgressBarUI(); // Update progress first

    if (!currentReadingPlan || !activePlanId) {
        dailyReadingDiv.innerHTML = "<p>Nenhum plano ativo selecionado.</p>";
        markAsReadButton.style.display = 'none';
        recalculatePlanButton.style.display = 'none';
        deleteCurrentPlanButton.style.display = 'none';
        showStatsButton.style.display = 'none';
        showHistoryButton.style.display = 'none';
        readingPlanSection.style.display = 'none';
        if(readingPlanTitle) readingPlanTitle.textContent = "Nenhum Plano Ativo";
        if(activePlanDriveLink) activePlanDriveLink.style.display = 'none';
        if(progressBarContainer) progressBarContainer.style.display = 'none';

        if (currentUser && userPlansList.length === 0) {
            planCreationSection.style.display = 'block';
        } else {
             // If logged in but no active plan, show scheduled readings, not creation form
             planCreationSection.style.display = 'none';
             if (currentUser) displayScheduledReadings();
        }
        return;
    }

    readingPlanSection.style.display = 'block';
    planCreationSection.style.display = 'none';

    const { plan, currentDay, name, startDate, endDate, allowedDays, googleDriveLink } = currentReadingPlan;
    const totalReadingDaysInPlan = Object.keys(plan || {}).length;
    const isCompleted = currentDay > totalReadingDaysInPlan;

    if (readingPlanTitle) {
        readingPlanTitle.textContent = name ? `${name}` : "Plano de Leitura Ativo";
    }
    if (activePlanDriveLink) {
        if (googleDriveLink) {
            activePlanDriveLink.href = googleDriveLink;
            activePlanDriveLink.style.display = 'inline-flex';
            activePlanDriveLink.setAttribute('title', `Abrir link do Drive para: ${name || 'este plano'}`);
        } else {
            activePlanDriveLink.style.display = 'none';
        }
    }

    markAsReadButton.style.display = 'inline-block';
    recalculatePlanButton.style.display = 'inline-block';
    deleteCurrentPlanButton.style.display = 'inline-block';
    showStatsButton.style.display = 'inline-block';
    showHistoryButton.style.display = 'inline-block';

    // Reset read ahead state if UI is loaded for a completed plan
    if (isCompleted) {
        isReadAheadPossible = false;
        if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
        readAheadTimeoutId = null;
    }

    markAsReadButton.disabled = isCompleted; // Disable button if completed
    recalculatePlanButton.disabled = isCompleted;

    if (isCompleted) {
        dailyReadingDiv.innerHTML = `
            <p style="font-weight: bold; color: var(--success-color);">Parabéns!</p>
            <p>Plano "${name || ''}" concluído!</p>
            <small>(${formatUTCDateStringToBrasilian(startDate)} - ${formatUTCDateStringToBrasilian(endDate)})</small>`;
        markAsReadButton.style.display = 'none'; // Hide button as well
        recalculatePlanButton.style.display = 'none'; // Hide recalculate too

    } else if (currentDay > 0 && currentDay <= totalReadingDaysInPlan && allowedDays) {
        const currentDayStr = currentDay.toString();
        const readingChapters = plan[currentDayStr] || [];
        const readingText = (readingChapters.length > 0)
            ? readingChapters.join(", ")
            : "Dia sem leitura designada (ou erro no plano).";

        const currentDateOfReadingStr = getEffectiveDateForDay(currentReadingPlan, currentDay);
        const formattedDate = currentDateOfReadingStr
            ? formatUTCDateStringToBrasilian(currentDateOfReadingStr)
            : "[Data Inválida]";

        dailyReadingDiv.innerHTML = `
            <p style="margin-bottom: 5px;">
                <strong style="color: var(--primary-action); font-size: 1.1em;">${formattedDate}</strong>
                <span style="font-size: 0.9em; color: var(--text-color-muted); margin-left: 10px;">
                    (Dia ${currentDay} de ${totalReadingDaysInPlan})
                </span>
            </p>
            <p style="margin-top: 5px;">${readingText}</p>`;

    } else {
        dailyReadingDiv.innerHTML = "<p>Erro: Dia inválido ou dados do plano incompletos para exibir leitura.</p>";
        console.error("Erro ao exibir leitura diária:", currentReadingPlan);
        markAsReadButton.style.display = 'none';
        recalculatePlanButton.style.display = 'none';
        showStatsButton.style.display = 'none';
        showHistoryButton.style.display = 'none';
        if(activePlanDriveLink) activePlanDriveLink.style.display = 'none';
    }
}

/** Marca dia(s) como lido(s), avança no plano, atualiza sequência e lida com leitura adiantada */
async function markAsRead() {
    if (!currentReadingPlan || !currentUser || !activePlanId || markAsReadButton.disabled) {
        console.log("Mark as read prevented:", { plan: !!currentReadingPlan, user: !!currentUser, planId: activePlanId, buttonDisabled: markAsReadButton ? markAsReadButton.disabled : 'unknown' });
        return;
    }

    const userId = currentUser.uid;
    const userDocRef = doc(db, 'users', userId);
    markAsReadButton.disabled = true; // Disable button immediately

    const currentDay = currentReadingPlan.currentDay;
    const totalReadingDaysInPlan = Object.keys(currentReadingPlan.plan || {}).length;
    const isPlanCompleted = currentDay > totalReadingDaysInPlan;

    if (isPlanCompleted) {
        console.warn("Tentativa de marcar como lido quando plano já concluído.");
        // Keep button disabled if already completed
        return;
    }

    const actualDateMarkedStr = getCurrentUTCDateString();
    const currentWeekId = getUTCWeekId();

    // Update weekly interactions for the actual day marked
    let updatedWeeklyData = JSON.parse(JSON.stringify(currentWeeklyInteractions || { weekId: currentWeekId, interactions: {} }));
    if (updatedWeeklyData.weekId !== currentWeekId) {
        updatedWeeklyData = { weekId: currentWeekId, interactions: {} };
    }
    if (!updatedWeeklyData.interactions) updatedWeeklyData.interactions = {};
    updatedWeeklyData.interactions[actualDateMarkedStr] = true;


    // --- Read Ahead Logic ---
    if (isReadAheadPossible) {
        // This is the SECOND click within the timeout
        console.log("Read Ahead Detected (Second Click)");
        isReadAheadPossible = false;
        if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
        readAheadTimeoutId = null;

        const secondDayToMark = currentDay; // The day currently displayed
        const thirdDayToShow = secondDayToMark + 1;
        const chaptersForSecondDay = currentReadingPlan.plan[secondDayToMark.toString()] || [];
        const scheduledDateForSecondDayStr = getEffectiveDateForDay(currentReadingPlan, secondDayToMark);

        if (!scheduledDateForSecondDayStr) {
            console.error("Could not determine scheduled date for the second read-ahead day:", secondDayToMark);
            showErrorMessage(planViewErrorDiv, "Erro ao calcular data agendada para leitura adiantada.");
            markAsReadButton.disabled = false; // Re-enable button on error
            return;
        }

        const secondLogEntry = {
            date: actualDateMarkedStr, // Logged on the actual day it was marked
            chapters: chaptersForSecondDay
        };

        // Ask user about recalculation
        const wantToRecalculate = confirm("Você marcou duas leituras seguidas. Deseja recalcular o plano para terminar mais cedo? (Se não, a leitura será marcada como adiantada)");

        if (wantToRecalculate) {
            console.log("User chose to recalculate.");
             // Just open the modal, don't save progress yet. Let the recalculation handle the state.
             // The first day's progress IS ALREADY SAVED from the first click.
             // The currentDay is already advanced by one.
            openModal('recalculate-modal');
            markAsReadButton.disabled = false; // Re-enable button as no action taken yet
            return; // Exit markAsRead, let modal handle next steps
        } else {
            // User chose NOT to recalculate - Mark the second day as 'read ahead'
            console.log("User chose NOT to recalculate. Marking second day read ahead.");
            const readAheadUpdateData = { [scheduledDateForSecondDayStr]: true };

            try {
                const success = await updateProgressInFirestore(userId, activePlanId, thirdDayToShow, updatedWeeklyData, secondLogEntry, readAheadUpdateData);
                 if (success) {
                    console.log("Second day marked as read ahead successfully.");
                    // UI update for the THIRD day
                    loadDailyReadingUI();
                    updateWeeklyTrackerUI(); // Will now show the read-ahead marker
                    await displayScheduledReadings(); // Update upcoming/overdue lists

                    // Check completion after the second read
                    if (thirdDayToShow > totalReadingDaysInPlan) {
                        setTimeout(() => alert(`Você concluiu o plano "${currentReadingPlan.name || ''}"! Parabéns!`), 100);
                        // Button is already disabled and will be handled by loadDailyReadingUI
                    } else {
                        markAsReadButton.disabled = false; // Re-enable for potential next read
                    }
                } else {
                    showErrorMessage(planViewErrorDiv, "Falha ao salvar progresso adiantado. Tente novamente.");
                    markAsReadButton.disabled = false; // Re-enable on failure
                }
            } catch (error) {
                console.error("Error marking second day read ahead:", error);
                showErrorMessage(planViewErrorDiv, `Erro ao salvar progresso adiantado: ${error.message}`);
                markAsReadButton.disabled = false; // Re-enable on error
            }
            return; // Finished handling second click (no recalc)
        }
    }

    // --- Normal First Click Logic (or click after timeout) ---
    console.log("Normal Mark Read (First Click or Timeout)");
    const firstDayToMark = currentDay;
    const nextReadingDayNumber = firstDayToMark + 1;
    const chaptersJustRead = currentReadingPlan.plan[firstDayToMark.toString()] || [];

    const firstLogEntry = {
        date: actualDateMarkedStr,
        chapters: chaptersJustRead
    };

    // Update Streak (only on the first actual interaction of the day)
    let firestoreStreakUpdate = {};
    if (userStreakData.lastInteractionDate !== actualDateMarkedStr) {
        let updatedStreakData = { ...userStreakData };
        let daysDiff = Infinity;
        if (updatedStreakData.lastInteractionDate) {
            daysDiff = dateDiffInDays(updatedStreakData.lastInteractionDate, actualDateMarkedStr);
        }

        if (daysDiff === 1) {
            updatedStreakData.current += 1;
        } else if (daysDiff > 1 || daysDiff === Infinity) {
            updatedStreakData.current = 1; // Reset if gap or first time
        }
        // If daysDiff <= 0 (same day or past), don't change current streak

        updatedStreakData.longest = Math.max(updatedStreakData.longest, updatedStreakData.current);
        updatedStreakData.lastInteractionDate = actualDateMarkedStr;

        // Only update if streak data actually changed
        if (userStreakData.current !== updatedStreakData.current || userStreakData.longest !== updatedStreakData.longest || userStreakData.lastInteractionDate !== updatedStreakData.lastInteractionDate) {
             firestoreStreakUpdate = {
                 lastStreakInteractionDate: updatedStreakData.lastInteractionDate,
                 currentStreak: updatedStreakData.current,
                 longestStreak: updatedStreakData.longest
             };
             userStreakData = { ...updatedStreakData }; // Update local state immediately
             console.log("Streak Updated:", userStreakData);
        } else {
            console.log("Streak: No change needed for today.");
        }

    } else {
        console.log("Streak: Already interacted today.");
    }

    // Save progress for the FIRST day marked
    try {
        // IMPORTANT: Do NOT send readAheadUpdate on the first click!
        const planUpdateSuccess = await updateProgressInFirestore(userId, activePlanId, nextReadingDayNumber, updatedWeeklyData, firstLogEntry, null);

        if (planUpdateSuccess) {
            console.log("First day marked successfully.");
            // Update streak in Firestore if needed
            if (Object.keys(firestoreStreakUpdate).length > 0) {
                try {
                    await updateDoc(userDocRef, firestoreStreakUpdate);
                    console.log("Streak data saved to Firestore.");
                } catch (streakError) {
                     console.error("Error saving streak data:", streakError);
                     // Continue even if streak update fails
                }
            }
            updateStreakCounterUI(); // Update UI regardless of save success

            // UI update for the NEXT day
            loadDailyReadingUI();
            updateWeeklyTrackerUI();
            await displayScheduledReadings();

            // Check completion after the first read
            if (nextReadingDayNumber > totalReadingDaysInPlan) {
                setTimeout(() => alert(`Você concluiu o plano "${currentReadingPlan.name || ''}"! Parabéns!`), 100);
                // Button will be disabled by loadDailyReadingUI
            } else {
                // *** Enable Read Ahead Possibility ***
                isReadAheadPossible = true;
                markAsReadButton.disabled = false; // RE-ENABLE the button
                // Start timeout to disable read-ahead possibility
                readAheadTimeoutId = setTimeout(() => {
                    console.log("Read Ahead Timeout Expired.");
                    isReadAheadPossible = false;
                    readAheadTimeoutId = null;
                }, READ_AHEAD_TIMEOUT_MS);
            }
        } else {
            showErrorMessage(planViewErrorDiv, "Falha ao salvar o progresso do plano. Tente novamente.");
            markAsReadButton.disabled = false; // Re-enable on failure
            updateStreakCounterUI(); // Update streak UI even on plan save failure
        }

    } catch (error) {
        console.error("Error during first markAsRead update:", error);
        showErrorMessage(planViewErrorDiv, `Erro ao salvar: ${error.message}`);
        markAsReadButton.disabled = false; // Re-enable on error
        updateStreakCounterUI(); // Update streak UI even on error
    }
}


/** Wrapper para chamar a exclusão de plano com confirmação */
function handleDeleteSpecificPlan(planIdToDelete) {
    if (!currentUser || !planIdToDelete) return;
    const userId = currentUser.uid;

    const planToDelete = userPlansList.find(p => p.id === planIdToDelete);
    const planName = planToDelete?.name || `ID ${planIdToDelete.substring(0,5)}...`;

    if (confirm(`Tem certeza que deseja excluir o plano "${planName}" permanentemente? Todo o progresso e histórico serão perdidos.`)) {
         if (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') { showLoading(managePlansLoadingDiv, true); }

        deletePlanFromFirestore(userId, planIdToDelete)
            .then(success => {
                if (success) {
                    alert(`Plano "${planName}" excluído com sucesso.`);
                     if (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') { closeModal('manage-plans-modal'); }
                }
                // Error message handled within deletePlanFromFirestore
            })
            .finally(() => {
                 if (managePlansModal.style.display === 'flex' || managePlansModal.style.display === 'block') { showLoading(managePlansLoadingDiv, false); }
            });
    }
}

// --- Funções de Recálculo ---

/** Abre um modal e reseta seus campos básicos */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Reset read ahead state when opening any modal, just in case
        isReadAheadPossible = false;
        if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
        readAheadTimeoutId = null;

        const errorDiv = modal.querySelector('.error-message');
        if (errorDiv) showErrorMessage(errorDiv, '');
        const extendOption = modal.querySelector('input[name="recalc-option"][value="extend_date"]');
        if (extendOption) extendOption.checked = true; // Padrão: estender data
        const paceInput = modal.querySelector('#new-pace-input');
        if (paceInput) paceInput.value = '3'; // Padrão: 3 capítulos/dia

        modal.style.display = 'flex';
    } else {
        console.error(`Modal com ID "${modalId}" não encontrado.`);
    }
}

/** Fecha um modal */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

/** Lida com a lógica de recálculo do plano ativo */
async function handleRecalculate() {
    if (!currentReadingPlan || !currentUser || !activePlanId || confirmRecalculateButton.disabled) return;

    // Reset read ahead state when recalculating
    isReadAheadPossible = false;
    if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
    readAheadTimeoutId = null;

    const userId = currentUser.uid;
    const recalcOptionRadio = document.querySelector('input[name="recalc-option"]:checked');
    const recalcOption = recalcOptionRadio ? recalcOptionRadio.value : null;

    if (!recalcOption) { showErrorMessage(recalculateErrorDiv, "Selecione uma opção de recálculo."); return; }

    showLoading(recalculateLoadingDiv, true);
    showErrorMessage(recalculateErrorDiv, '');
    confirmRecalculateButton.disabled = true;

    const { chaptersList, currentDay, plan: originalPlanMap, startDate: originalStartDate, allowedDays, name, readLog, weeklyInteractions, createdAt, googleDriveLink, endDate: currentEndDate } = JSON.parse(JSON.stringify(currentReadingPlan)); // Copia profunda
    const totalReadingDaysOriginal = Object.keys(originalPlanMap || {}).length;
    const validAllowedDays = (Array.isArray(allowedDays) && allowedDays.length > 0) ? allowedDays : [0, 1, 2, 3, 4, 5, 6]; // Usa dias selecionados ou todos

    try {
        // Calculate remaining chapters based on currentDay, not readLog
        // Assume chapters up to (currentDay - 1) are 'covered'
        let chaptersCoveredCount = 0;
        for(let i = 1; i < currentDay; i++) {
            if (originalPlanMap[i.toString()]) {
                chaptersCoveredCount += (originalPlanMap[i.toString()] || []).length;
            }
        }
        chaptersCoveredCount = Math.min(chaptersCoveredCount, chaptersList.length);
        const remainingChapters = chaptersList.slice(chaptersCoveredCount);

        if (remainingChapters.length === 0) throw new Error("Não há capítulos restantes para recalcular. O plano parece estar concluído ou adiantado.");


        let newTotalReadingDaysForRemainder = 0;
        let newPlanMapForRemainder = {};

        if (recalcOption === 'extend_date') {
             // Calculate average pace based on original plan structure
            const originalReadingDaysWithContent = Object.keys(originalPlanMap || {}).filter(dayKey => Array.isArray(originalPlanMap[dayKey]) && originalPlanMap[dayKey].length > 0).length;
            const avgPace = originalReadingDaysWithContent > 0 ? Math.max(1, Math.ceil(chaptersList.length / originalReadingDaysWithContent)) : 3; // Use ceiling for pace
            newTotalReadingDaysForRemainder = Math.max(1, Math.ceil(remainingChapters.length / avgPace));
            newPlanMapForRemainder = distributeChaptersOverReadingDays(remainingChapters, newTotalReadingDaysForRemainder);

        } else if (recalcOption === 'increase_pace') {
            const todayDate = new Date(getCurrentUTCDateString() + 'T00:00:00Z');
            const originalEndDate = new Date(currentEndDate + 'T00:00:00Z');

            // Determine the start date for counting remaining days: today or the originally scheduled date for currentDay, whichever is later.
            const originalScheduledDateForCurrentDayStr = getEffectiveDateForDay(currentReadingPlan, currentDay); // Use original plan data
            let countStartDate = todayDate;
            if (originalScheduledDateForCurrentDayStr && new Date(originalScheduledDateForCurrentDayStr + 'T00:00:00Z') > todayDate) {
                countStartDate = new Date(originalScheduledDateForCurrentDayStr + 'T00:00:00Z');
            }

            if (isNaN(originalEndDate.getTime()) || originalEndDate < countStartDate) {
                 console.warn("Recalculate: Data final original inválida ou já passou para 'increase_pace'. Estendendo a data.");
                 // Fallback to extend_date logic
                 const originalReadingDaysWithContent = Object.keys(originalPlanMap || {}).filter(dayKey => Array.isArray(originalPlanMap[dayKey]) && originalPlanMap[dayKey].length > 0).length;
                 const avgPace = originalReadingDaysWithContent > 0 ? Math.max(1, Math.ceil(chaptersList.length / originalReadingDaysWithContent)) : 3;
                 newTotalReadingDaysForRemainder = Math.max(1, Math.ceil(remainingChapters.length / avgPace));
            } else {
                let remainingReadingDaysCount = 0;
                let currentDate = new Date(countStartDate);
                // Count reading days from countStartDate up to and including originalEndDate
                while (currentDate <= originalEndDate) {
                     if (validAllowedDays.includes(currentDate.getUTCDay())) { remainingReadingDaysCount++; }
                     currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                     if(remainingReadingDaysCount > 365*10) { console.warn("Safety break: increase_pace date count exceeded limit."); break; } // Safety break
                }
                 newTotalReadingDaysForRemainder = Math.max(1, remainingReadingDaysCount);
            }
            newPlanMapForRemainder = distributeChaptersOverReadingDays(remainingChapters, newTotalReadingDaysForRemainder);

        } else if (recalcOption === 'new_pace') {
            const newPacePerReadingDay = parseInt(newPaceInput.value, 10);
            if (isNaN(newPacePerReadingDay) || newPacePerReadingDay <= 0) throw new Error("Novo ritmo de capítulos por dia de leitura inválido.");
            newTotalReadingDaysForRemainder = Math.max(1, Math.ceil(remainingChapters.length / newPacePerReadingDay));
            newPlanMapForRemainder = distributeChaptersOverReadingDays(remainingChapters, newTotalReadingDaysForRemainder);
        }

        if (Object.keys(newPlanMapForRemainder).length === 0 && remainingChapters.length > 0) {
             throw new Error("Falha ao redistribuir os capítulos restantes. Verifique a lógica de cálculo dos dias.");
        }

        // Determine the effective start date for the recalculated portion
        const todayStr = getCurrentUTCDateString();
        const scheduledDateForCurrentDayStr = getEffectiveDateForDay(currentReadingPlan, currentDay); // Use original plan data
        let recalcEffectiveStartDate = todayStr;
         // If the original schedule for today is in the future, start counting from there
        if (scheduledDateForCurrentDayStr && scheduledDateForCurrentDayStr > todayStr) {
            recalcEffectiveStartDate = scheduledDateForCurrentDayStr;
        }
        console.log(`Recálculo usará como data base para o dia ${currentDay} (recalcEffectiveStartDate): ${recalcEffectiveStartDate}`);

        // Combine the old plan part (before currentDay) with the new recalculated part
        const updatedFullPlanMap = {};
        for (let dayKey in originalPlanMap) {
            const dayNum = parseInt(dayKey, 10);
            if (dayNum < currentDay) { updatedFullPlanMap[dayKey] = originalPlanMap[dayKey]; }
        }
        let newMapDayCounter = 0;
        Object.keys(newPlanMapForRemainder).sort((a,b) => parseInt(a) - parseInt(b)).forEach(remDayKey => {
            const newDayKey = (currentDay + newMapDayCounter).toString();
            updatedFullPlanMap[newDayKey] = newPlanMapForRemainder[remDayKey];
            newMapDayCounter++;
        });

        // Calculate the NEW end date based on the recalculated remainder
        const newEndDateStr = calculateDateForDay(recalcEffectiveStartDate, newTotalReadingDaysForRemainder, allowedDays);
        if (!newEndDateStr) throw new Error(`Falha ao calcular a nova data final após recálculo, partindo de ${recalcEffectiveStartDate} por ${newTotalReadingDaysForRemainder} dias de leitura.`);

        const updatedPlanData = {
            name: name,
            chaptersList: chaptersList,
            totalChapters: chaptersList.length,
            allowedDays: allowedDays,
            readLog: readLog || {}, // Keep existing log
            weeklyInteractions: weeklyInteractions || { weekId: getUTCWeekId(), interactions: {} }, // Keep existing interactions
            createdAt: createdAt || serverTimestamp(),
            googleDriveLink: googleDriveLink || null,
            startDate: originalStartDate, // Keep original start date

            plan: updatedFullPlanMap, // New combined plan map
            currentDay: currentDay, // Keep currentDay as is (user starts reading this day next)
            endDate: newEndDateStr, // New calculated end date

            recalculationBaseDay: currentDay, // Mark the day recalculation happened
            recalculationBaseDate: recalcEffectiveStartDate // Mark the date it becomes effective
            // readAheadDates will be reset by saveRecalculatedPlanToFirestore
        };

        const success = await saveRecalculatedPlanToFirestore(userId, activePlanId, updatedPlanData);

        if (success) {
            alert("Seu plano foi recalculado com sucesso! O cronograma restante foi ajustado.");
            closeModal('recalculate-modal');
            loadDailyReadingUI(); // Reload UI with recalculated data
            updateProgressBarUI();
            updateWeeklyTrackerUI();
            await displayScheduledReadings();
            populatePlanSelector(); // Update selector options if end date changed
        }

    } catch (error) {
        console.error("Erro ao recalcular plano:", error);
        showErrorMessage(recalculateErrorDiv, `Erro: ${error.message}`);
    } finally {
        showLoading(recalculateLoadingDiv, false);
        if (confirmRecalculateButton) confirmRecalculateButton.disabled = false;
        // Re-enable mark as read button if it was disabled during recalc process, unless completed
        if (markAsReadButton && !(currentReadingPlan && currentReadingPlan.currentDay > Object.keys(currentReadingPlan.plan || {}).length)) {
             markAsReadButton.disabled = false;
        }
    }
}

// --- Funções de Histórico e Estatísticas ---

/** Exibe o histórico de leitura do plano ativo no modal */
function displayReadingHistory() {
    if (!currentReadingPlan || !historyListDiv) {
        if(historyListDiv) historyListDiv.innerHTML = '<p>Nenhum plano ativo selecionado ou histórico disponível.</p>';
        return;
    }

    showLoading(historyLoadingDiv, false);
    showErrorMessage(historyErrorDiv, '');
    historyListDiv.innerHTML = '';

    const readLog = currentReadingPlan.readLog || {};
    const sortedDates = Object.keys(readLog)
                          .filter(dateStr => /^\d{4}-\d{2}-\d{2}$/.test(dateStr))
                          .sort()
                          .reverse(); // Mais recentes primeiro

    if (sortedDates.length === 0) {
        historyListDiv.innerHTML = '<p>Nenhum registro de leitura encontrado para este plano.</p>';
        return;
    }

    sortedDates.forEach(dateStr => {
        const chaptersRead = readLog[dateStr] || [];
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('history-entry');
        const formattedDate = formatUTCDateStringToBrasilian(dateStr);
        const chaptersText = chaptersRead.length > 0 ? chaptersRead.join(', ') : 'Nenhum capítulo registrado nesta data.';
        entryDiv.innerHTML = `
            <span class="history-date">${formattedDate}</span>
            <span class="history-chapters">${chaptersText}</span>
        `;
        historyListDiv.appendChild(entryDiv);
    });
}

/** Calcula e exibe estatísticas no modal */
async function calculateAndShowStats() {
    if (!currentUser || !statsContentDiv) return;

    showLoading(statsLoadingDiv, true);
    showErrorMessage(statsErrorDiv, '');
    statsContentDiv.style.display = 'none';

    try {
        let activePlanName = "--";
        let activePlanProgress = 0;
        let activePlanTotalReadingDays = 0;
        let activePlanChaptersReadFromLog = 0;
        let activePlanDaysReadFromLog = 0;
        let planIsCompleted = false;

        if (currentReadingPlan && activePlanId) {
            activePlanName = currentReadingPlan.name || `ID ${activePlanId.substring(0,5)}...`;
            activePlanTotalReadingDays = Object.keys(currentReadingPlan.plan || {}).length;

            if (activePlanTotalReadingDays > 0) {
                const effectiveCurrentDay = Math.max(1, currentReadingPlan.currentDay || 1); // Ensure currentDay is at least 1
                const progress = ((effectiveCurrentDay - 1) / activePlanTotalReadingDays) * 100;
                activePlanProgress = Math.min(100, Math.max(0, progress));
                planIsCompleted = effectiveCurrentDay > activePlanTotalReadingDays;
                if (planIsCompleted) activePlanProgress = 100;
            }

            const readLog = currentReadingPlan.readLog || {};
            // Reset counters before recalculating
            activePlanChaptersReadFromLog = 0;
            activePlanDaysReadFromLog = 0;
            Object.values(readLog).forEach(chaptersArray => {
                if (Array.isArray(chaptersArray)) {
                    activePlanChaptersReadFromLog += chaptersArray.length;
                }
            });
            // Count days based on keys in readLog
            activePlanDaysReadFromLog = Object.keys(readLog).filter(dateStr => /^\d{4}-\d{2}-\d{2}$/.test(dateStr)).length;
        }

        statsActivePlanName.textContent = activePlanName;
        statsActivePlanProgress.textContent = `${Math.round(activePlanProgress)}%`;
        statsTotalChapters.textContent = activePlanChaptersReadFromLog > 0 ? activePlanChaptersReadFromLog : "--";
        statsPlansCompleted.textContent = planIsCompleted ? "Sim" : (activePlanId ? "Não" : "--");

        const avgPace = activePlanDaysReadFromLog > 0 ? (activePlanChaptersReadFromLog / activePlanDaysReadFromLog).toFixed(1) : "--";
        statsAvgPace.textContent = avgPace;

        statsContentDiv.style.display = 'block';

    } catch (error) {
        console.error("Error calculating stats:", error);
        showErrorMessage(statsErrorDiv, `Erro ao calcular estatísticas: ${error.message}`);
    } finally {
        showLoading(statsLoadingDiv, false);
    }
}

// --- Função para Leituras Atrasadas e Próximas ---
/**
 * Busca e exibe leituras atrasadas e as próximas N leituras agendadas.
 * @param {number} upcomingCount - Quantas próximas leituras exibir.
 */
async function displayScheduledReadings(upcomingCount = 3) {
    if (!overdueReadingsSection || !overdueReadingsListDiv || !upcomingReadingsSection || !upcomingReadingsListDiv || !currentUser) {
        console.warn("Elementos UI para 'Overdue/Upcoming Readings' ou usuário não disponíveis.");
        if (overdueReadingsSection) overdueReadingsSection.style.display = 'none';
        if (upcomingReadingsSection) upcomingReadingsSection.style.display = 'none';
        return;
    }

    showLoading(overdueReadingsLoadingDiv, true);
    showLoading(upcomingReadingsLoadingDiv, true);
    overdueReadingsSection.style.display = 'block'; // Show initially, hide later if empty
    upcomingReadingsSection.style.display = 'block'; // Show initially, hide later if empty
    overdueReadingsListDiv.innerHTML = '';
    upcomingReadingsListDiv.innerHTML = '';
    // Don't clear plan view error here, it might be relevant
    // showErrorMessage(planViewErrorDiv, '');

    const overdueList = [];
    const upcomingList = [];
    const todayStr = getCurrentUTCDateString();

    if (userPlansList.length === 0) {
        overdueReadingsListDiv.innerHTML = '<p>Nenhum plano para verificar.</p>';
        upcomingReadingsListDiv.innerHTML = '<p>Você ainda não tem planos de leitura.</p>';
        showLoading(overdueReadingsLoadingDiv, false);
        showLoading(upcomingReadingsLoadingDiv, false);
         // Explicitly hide sections if there are no plans
         overdueReadingsSection.style.display = 'none';
         upcomingReadingsSection.style.display = 'none';
        return;
    }

    try {
        for (const plan of userPlansList) {
             // Add check for readAheadDates existence
            if (!plan.id || !plan.plan || typeof plan.currentDay !== 'number' || !plan.startDate || !plan.allowedDays || typeof plan.plan !== 'object' || Object.keys(plan.plan).length === 0 || typeof plan.readAheadDates !== 'object') {
                console.warn(`Plano ${plan.id || 'desconhecido'} (${plan.name || 'sem nome'}) pulado por falta de dados, plano vazio, ou readAheadDates ausente.`);
                continue;
            }

            const totalReadingDays = Object.keys(plan.plan).length;

            // --- Overdue Check ---
            // Iterate from day 1 up to (but not including) currentDay
            for (let dayNum = 1; dayNum < plan.currentDay; dayNum++) {
                 const scheduledDateStr = getEffectiveDateForDay(plan, dayNum);
                 // Check if the day IS in the past AND was NOT marked as read ahead
                 if (scheduledDateStr && scheduledDateStr < todayStr && !plan.readAheadDates[scheduledDateStr]) {
                     // Now, check if there's NO real interaction log for that specific PAST date either
                     let interactionFound = false;
                     if (plan.weeklyInteractions && typeof plan.weeklyInteractions.interactions === 'object') {
                         // Simple check: Was there *any* interaction on that date according to weeklyInteractions?
                         // This isn't perfect as weeklyInteractions only stores the current week, but it's a reasonable check.
                         // A more robust check would involve querying the readLog, but that's slower.
                         // Let's use the simpler check for now.
                          if (plan.weeklyInteractions.interactions[scheduledDateStr]) {
                               interactionFound = true;
                          }
                          // Alternative: Check readLog directly (more accurate but potentially slower if log is huge)
                          // if (plan.readLog && plan.readLog[scheduledDateStr]) {
                          //     interactionFound = true;
                          // }
                     }
                     // If it's past, wasn't marked ahead, and no interaction logged for that date... it's overdue.
                     if (!interactionFound) {
                         const chaptersForDay = plan.plan[dayNum.toString()] || [];
                         if (chaptersForDay.length > 0) {
                             overdueList.push({
                                 date: scheduledDateStr, // The date it SHOULD have been read
                                 planId: plan.id,
                                 planName: plan.name || `Plano ${plan.id.substring(0,5)}...`,
                                 chapters: chaptersForDay.join(', '),
                                 isOverdue: true,
                                 dayNumber: dayNum // Add day number for potential debugging/sorting
                             });
                         }
                     }
                 }
            }


            // --- Upcoming Check ---
            let upcomingFoundForThisPlan = 0;
            // Start search from the plan's currentDay
            for (let dayOffset = 0; upcomingFoundForThisPlan < upcomingCount; dayOffset++) {
                const targetDayNumber = plan.currentDay + dayOffset;
                if (targetDayNumber > totalReadingDays) break; // Stop if past the end of the plan

                const dateStr = getEffectiveDateForDay(plan, targetDayNumber);

                if (dateStr) {
                    // Include today and future dates
                    if (dateStr >= todayStr) {
                         const chaptersForDay = plan.plan[targetDayNumber.toString()] || [];
                         if (chaptersForDay.length > 0) {
                             upcomingList.push({
                                 date: dateStr,
                                 planId: plan.id,
                                 planName: plan.name || `Plano ${plan.id.substring(0,5)}...`,
                                 chapters: chaptersForDay.join(', '),
                                 isOverdue: false,
                                 dayNumber: targetDayNumber // Add day number
                             });
                             upcomingFoundForThisPlan++;
                         }
                    }
                } else {
                     console.warn(`Não foi possível calcular data efetiva para dia ${targetDayNumber} do plano ${plan.id}. Parando busca de próximas para este plano.`);
                     break; // Stop searching for this plan if date calculation fails
                }

                 // Safety break to prevent infinite loops in weird scenarios
                 if (dayOffset > totalReadingDays + upcomingCount + 14) { // Increased safety margin
                     console.warn(`Safety break atingido ao buscar próximas leituras para plano ${plan.id}`);
                     break;
                 }
            }
        } // End loop through plans

        // --- Render Overdue Items ---
        if (overdueList.length > 0) {
            overdueList.sort((a, b) => a.date.localeCompare(b.date) || a.dayNumber - b.dayNumber); // Sort by date, then day number
            overdueList.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('overdue-reading-item');
                itemDiv.innerHTML = `
                    <div class="overdue-date">${formatUTCDateStringToBrasilian(item.date)} (Dia ${item.dayNumber} - Atrasada!)</div>
                    <div class="overdue-plan-name">${item.planName}</div>
                    <div class="overdue-chapters">${item.chapters}</div>
                `;
                itemDiv.addEventListener('click', () => {
                     // Activate the plan associated with the overdue item
                     if (item.planId !== activePlanId) { setActivePlan(item.planId); }
                     else {
                        // If already active, just scroll to it
                        readingPlanSection.scrollIntoView({ behavior: 'smooth' });
                     }
                });
                itemDiv.style.cursor = 'pointer';
                overdueReadingsListDiv.appendChild(itemDiv);
            });
            overdueReadingsSection.style.display = 'block'; // Ensure section is visible
        } else {
            overdueReadingsListDiv.innerHTML = '<p>Nenhuma leitura atrasada encontrada.</p>';
             overdueReadingsSection.style.display = 'none'; // Hide section if empty
        }

        // --- Render Upcoming Items ---
        if (upcomingList.length > 0) {
            upcomingList.sort((a, b) => a.date.localeCompare(b.date) || a.dayNumber - b.dayNumber); // Sort by date, then day number
            const uniqueUpcoming = [];
            const seenKeys = new Set();
            // Ensure we only show N unique *days*, accounting for multiple plans on the same day
            for(const item of upcomingList) {
                const key = `${item.date}-${item.planId}-${item.dayNumber}`; // Unique key
                if (!seenKeys.has(key)) {
                    uniqueUpcoming.push(item);
                    seenKeys.add(key);
                }
                if (uniqueUpcoming.length >= upcomingCount) break; // Stop once we have enough unique items
            }

            uniqueUpcoming.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('upcoming-reading-item');
                itemDiv.innerHTML = `
                    <div class="upcoming-date">${formatUTCDateStringToBrasilian(item.date)} (Dia ${item.dayNumber})</div>
                    <div class="upcoming-plan-name">${item.planName}</div>
                    <div class="upcoming-chapters">${item.chapters}</div>
                `;
                itemDiv.addEventListener('click', () => {
                     if (item.planId !== activePlanId) { setActivePlan(item.planId); }
                     else { readingPlanSection.scrollIntoView({ behavior: 'smooth' }); }
                });
                itemDiv.style.cursor = 'pointer';
                upcomingReadingsListDiv.appendChild(itemDiv);
            });
             upcomingReadingsSection.style.display = 'block'; // Ensure section is visible
        } else {
            upcomingReadingsListDiv.innerHTML = '<p>Nenhuma leitura próxima encontrada.</p>';
             upcomingReadingsSection.style.display = 'none'; // Hide section if empty
        }

    } catch (error) {
        console.error("Erro ao buscar leituras agendadas:", error);
        if (overdueReadingsListDiv) overdueReadingsListDiv.innerHTML = '<p style="color: red;">Erro ao verificar atrasos.</p>';
        if (upcomingReadingsListDiv) upcomingReadingsListDiv.innerHTML = '<p style="color: red;">Erro ao carregar próximas leituras.</p>';
        showErrorMessage(planViewErrorDiv, `Erro nas leituras agendadas: ${error.message}`);
        // Hide sections on error
        overdueReadingsSection.style.display = 'none';
        upcomingReadingsSection.style.display = 'none';
    } finally {
        showLoading(overdueReadingsLoadingDiv, false);
        showLoading(upcomingReadingsLoadingDiv, false);
        // Visibility is now handled based on content within the try/catch/finally blocks
    }
}


/** Atualiza a UI do painel de sequência */
function updateStreakCounterUI() {
    if (!streakCounterSection || !currentStreakValue || !longestStreakValue) return;

    if (currentUser && userInfo) {
        // Ensure streak data is valid numbers
        const current = (typeof userStreakData?.current === 'number' && isFinite(userStreakData.current)) ? userStreakData.current : 0;
        const longest = (typeof userStreakData?.longest === 'number' && isFinite(userStreakData.longest)) ? userStreakData.longest : 0;

        currentStreakValue.textContent = current;
        longestStreakValue.textContent = longest;
        // Show streak only if not on the creation screen
        if (planCreationSection.style.display !== 'block') {
            streakCounterSection.style.display = 'flex';
        } else {
             streakCounterSection.style.display = 'none';
        }
    } else {
        streakCounterSection.style.display = 'none';
    }
}

// --- Inicialização e Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
    if (!loginButton || !createPlanButton || !markAsReadButton || !recalculateModal || !managePlansModal ||
        !statsModal || !historyModal || !planSelect || !periodicityCheckboxes ||
        !overdueReadingsSection || !overdueReadingsListDiv || !upcomingReadingsSection || !upcomingReadingsListDiv ||
        !googleDriveLinkInput || !readingPlanTitle || !activePlanDriveLink ||
        !streakCounterSection || !currentStreakValue || !longestStreakValue
       ) {
        console.error("Erro crítico: Elementos essenciais da UI não encontrados.");
        document.body.innerHTML = '<p style="color: red; text-align: center; padding: 50px;">Erro ao carregar a página. Elementos faltando.</p>';
        return;
    }

    populateBookSelectors();
    togglePlanCreationOptions();

    // --- Listeners Auth ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); if (loginButton.disabled) return;
        showLoading(authLoadingDiv, true); showErrorMessage(authErrorDiv, ''); loginButton.disabled = true;
        try {
            await signInWithEmailAndPassword(auth, loginEmailInput.value, loginPasswordInput.value);
        } catch (error) {
            console.error("Login error:", error);
            showErrorMessage(authErrorDiv, `Erro de login: ${error.message}`); // Show message, not code
        } finally {
             showLoading(authLoadingDiv, false); loginButton.disabled = false;
        }
    });
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); if (signupButton.disabled) return;
        showLoading(authLoadingDiv, true); showErrorMessage(signupErrorDiv, ''); signupButton.disabled = true;
        try {
            await createUserWithEmailAndPassword(auth, signupEmailInput.value, signupPasswordInput.value);
             alert("Cadastro realizado com sucesso! Você já está logado.");
             if (signupEmailInput) signupEmailInput.value = '';
             if (signupPasswordInput) signupPasswordInput.value = '';
        } catch (error) {
            console.error("Signup error:", error);
            showErrorMessage(signupErrorDiv, `Erro no cadastro: ${error.message}`); // Show message, not code
        } finally {
            showLoading(authLoadingDiv, false); signupButton.disabled = false;
        }
    });
    logoutButton.addEventListener('click', async () => {
        if (logoutButton.disabled) return;
        logoutButton.disabled = true;
        // Reset read ahead state on logout
        isReadAheadPossible = false;
        if (readAheadTimeoutId) clearTimeout(readAheadTimeoutId);
        readAheadTimeoutId = null;
        try { await signOut(auth); }
        catch (error) { console.error("Sign out error:", error); alert(`Erro ao sair: ${error.message}`); }
        // No finally needed here as onAuthStateChanged will handle UI update
    });
    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms(false); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms(true); });

    // --- Listeners Plan Creation ---
    createPlanButton.addEventListener('click', createReadingPlan);
    if (cancelCreationButton) cancelCreationButton.addEventListener('click', cancelPlanCreation);
    creationMethodRadios.forEach(radio => radio.addEventListener('change', togglePlanCreationOptions));
    durationMethodRadios.forEach(radio => radio.addEventListener('change', togglePlanCreationOptions));
    if (chaptersInput) chaptersInput.addEventListener('input', updateBookSuggestions);

     // --- Listeners Reading Plan ---
     markAsReadButton.addEventListener('click', markAsRead); // Main function call
     deleteCurrentPlanButton.addEventListener('click', () => {
         if(activePlanId && currentReadingPlan) { handleDeleteSpecificPlan(activePlanId); }
         else { alert("Nenhum plano ativo para deletar."); }
     });
     recalculatePlanButton.addEventListener('click', () => openModal('recalculate-modal'));
     showStatsButton.addEventListener('click', () => { calculateAndShowStats(); openModal('stats-modal'); });
     showHistoryButton.addEventListener('click', () => { displayReadingHistory(); openModal('history-modal'); });

     // --- Listener Header Plan Selector ---
     planSelect.addEventListener('change', (e) => {
         const selectedPlanId = e.target.value;
         if (selectedPlanId && selectedPlanId !== activePlanId) { setActivePlan(selectedPlanId); }
     });
     managePlansButton.addEventListener('click', () => { populateManagePlansModal(); openModal('manage-plans-modal'); });

     // --- Listeners Modals ---
     confirmRecalculateButton.addEventListener('click', handleRecalculate);
     createNewPlanButton.addEventListener('click', () => { closeModal('manage-plans-modal'); showPlanCreationSection(); });
     // Add event listeners to close modals on overlay click or close button click
     [recalculateModal, managePlansModal, statsModal, historyModal].forEach(modal => {
         if (modal) {
             // Close on overlay click
             modal.addEventListener('click', (event) => {
                 if (event.target === modal) {
                     closeModal(modal.id);
                 }
             });
             // Close on button click (using function for cleaner code)
             const closeBtn = modal.querySelector('.close-button');
             if (closeBtn && !closeBtn.dataset.listenerAttached) { // Prevent attaching multiple listeners
                 closeBtn.addEventListener('click', () => closeModal(modal.id));
                 closeBtn.dataset.listenerAttached = 'true';
             }
         }
     });

    // --- Firebase Auth State Observer ---
    onAuthStateChanged(auth, (user) => {
        // Reset button states on auth change
        if (loginButton) loginButton.disabled = false;
        if (signupButton) signupButton.disabled = false;
        if (logoutButton) logoutButton.disabled = false;
        updateUIBasedOnAuthState(user); // This handles the main UI logic and calls loadUserDataAndPlans
    });

    console.log("Event listeners attached and application initialized.");
});

// --- END OF FILE script.js ---
