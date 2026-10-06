// === Helpers ===

/**
 * Helper to create DOM elements
 * @param {string} tag
 * @param {Object} attributes
 * @param {Array<HTMLElement|string>|HTMLElement|string} children
 * @returns {HTMLElement}
 */
function el(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key === 'onClick') {
      element.addEventListener('click', value);
    } else if (key === 'style') {
      for (const [styleKey, styleValue] of Object.entries(value)) {
        element.style[styleKey] = styleValue;
      }
    } else {
      element.setAttribute(key, value);
    }
  }

  const appendChildren = (child) => {
    if (Array.isArray(child)) {
      child.forEach(appendChildren);
    } else if (child instanceof HTMLElement || child instanceof DocumentFragment) {
      element.appendChild(child);
    } else if (child !== null && child !== undefined) {
      element.appendChild(document.createTextNode(String(child)));
    }
  };

  appendChildren(children);

  return element;
}

// === State ===
const state = {
  moves: 0,
  pairsFound: 0,
  cards: [], // Array of objects { id, emoji }
  firstCard: null,
  secondCard: null,
  lockBoard: false,
  timerId: null, // For clearing timeout on new game
  totalPairs: 8,
};

// 8 distinct emojis for pairs
const cardImages = ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝'];

// Initialize App Container (since body must be empty)
const appContainer = el('div', { id: 'app-container' });
document.body.appendChild(appContainer);

// Setup UI elements placeholders
let movesElement;
let pairsElement;
let boardElement;

// === Game Logic ===

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function generateCards() {
  const cards = [...cardImages, ...cardImages];
  shuffle(cards);
  return cards.map((emoji, index) => ({ id: index, emoji }));
}

function updateStatsUI() {
  if (movesElement) movesElement.textContent = `Ходы: ${state.moves}`;
  if (pairsElement) pairsElement.textContent = `Найдено: ${state.pairsFound} / ${state.totalPairs}`;
}

function handleCardClick(cardData, cardElement) {
  if (state.lockBoard) return;
  if (cardElement.classList.contains('open') || cardElement.classList.contains('matched')) return;

  cardElement.classList.add('open');

  if (!state.firstCard) {
    state.firstCard = { data: cardData, element: cardElement };
    return;
  }

  state.secondCard = { data: cardData, element: cardElement };
  state.moves++;
  updateStatsUI();
  checkForMatch();
}

function checkForMatch() {
  const isMatch = state.firstCard.data.emoji === state.secondCard.data.emoji;

  if (isMatch) {
    disableCards();
    state.pairsFound++;
    updateStatsUI();
    if (state.pairsFound === state.totalPairs) {
      setTimeout(showWinModal, 500); // Wait a bit for the last card to flip
    }
  } else {
    unflipCards();
  }
}

function disableCards() {
  state.firstCard.element.classList.add('matched');
  state.secondCard.element.classList.add('matched');
  resetBoard();
}

function unflipCards() {
  state.lockBoard = true;

  state.timerId = setTimeout(() => {
    state.firstCard.element.classList.remove('open');
    state.secondCard.element.classList.remove('open');
    resetBoard();
  }, 1000); // 1000ms delay as requested (700-1500 range)
}

function resetBoard() {
  [state.firstCard, state.secondCard] = [null, null];
  state.lockBoard = false;
  state.timerId = null;
}

function renderBoard() {
  if (boardElement) {
    boardElement.remove();
  }

  boardElement = el('div', { id: 'game-board' });

  state.cards.forEach(cardData => {
    const cardFront = el('div', { className: 'card-front' }, [cardData.emoji]);
    const cardBack = el('div', { className: 'card-back' });
    const cardInner = el('div', { className: 'card-inner' }, [cardFront, cardBack]);

    const cardElement = el('div', { className: 'card', dataset: { id: cardData.id } }, [cardInner]);

    cardElement.addEventListener('click', () => handleCardClick(cardData, cardElement));

    boardElement.appendChild(cardElement);
  });

  return boardElement;
}

// === Storage ===

function getLeaderboard() {
  const data = localStorage.getItem('memoryGameLeaderboard');
  return data ? JSON.parse(data) : [];
}

function saveToLeaderboard(moves) {
  const leaderboard = getLeaderboard();

  // Create current date as DD.MM.YYYY
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${day}.${month}.${year}`;

  leaderboard.push({ moves, date: dateStr, timestamp: Date.now() });

  // Sort by moves (asc), then by timestamp (asc - earlier games first)
  leaderboard.sort((a, b) => {
    if (a.moves !== b.moves) return a.moves - b.moves;
    return a.timestamp - b.timestamp;
  });

  // Keep top 10
  const top10 = leaderboard.slice(0, 10);
  localStorage.setItem('memoryGameLeaderboard', JSON.stringify(top10));
}

// === Modals ===
let currentModal = null;

function createModalOverlay() {
  const overlay = el('div', { className: 'modal-overlay' });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

const modalOverlay = createModalOverlay();

function closeModal() {
  if (currentModal) {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      while (modalOverlay.firstChild) {
        modalOverlay.removeChild(modalOverlay.firstChild);
      }
      currentModal = null;
    }, 300);
  }
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentModal) {
    closeModal();
  }
});

function showWinModal() {
  saveToLeaderboard(state.moves);

  const title = el('h2', {}, ['Победа!']);
  const message = el('p', {}, [`Вы нашли все пары за ${state.moves} ходов.`]);

  const newGameBtn = el('button', { onClick: () => { closeModal(); initGame(); } }, ['Новая игра']);
  const closeBtn = el('button', { onClick: closeModal }, ['Закрыть']);
  const buttonsDiv = el('div', { className: 'modal-buttons' }, [newGameBtn, closeBtn]);

  const content = el('div', { className: 'modal-content' }, [title, message, buttonsDiv]);

  modalOverlay.appendChild(content);
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  currentModal = 'win';
}

function showLeaderboardModal() {
  const leaderboard = getLeaderboard();

  const title = el('h2', {}, ['Таблица лидеров']);

  let bodyContent;
  if (leaderboard.length === 0) {
    bodyContent = el('p', {}, ['Пока нет результатов']);
  } else {
    const tableHeader = el('tr', {}, [
      el('th', {}, ['Место']),
      el('th', {}, ['Ходы']),
      el('th', {}, ['Дата'])
    ]);

    const tableRows = leaderboard.map((entry, index) => {
      return el('tr', {}, [
        el('td', {}, [index + 1]),
        el('td', {}, [entry.moves]),
        el('td', {}, [entry.date])
      ]);
    });

    bodyContent = el('table', { className: 'leaderboard-table' }, [tableHeader, ...tableRows]);
  }

  const closeBtn = el('button', { onClick: closeModal }, ['Закрыть']);
  const buttonsDiv = el('div', { className: 'modal-buttons' }, [closeBtn]);

  const content = el('div', { className: 'modal-content' }, [title, bodyContent, buttonsDiv]);

  modalOverlay.appendChild(content);
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  currentModal = 'leaderboard';
}

// === Initialization ===

function renderHeader() {
  const newGameBtn = el('button', { onClick: initGame }, ['Новая игра']);
  const leaderboardBtn = el('button', { onClick: showLeaderboardModal }, ['Таблица лидеров']);
  const header = el('header', {}, [newGameBtn, leaderboardBtn]);
  return header;
}

function renderStats() {
  movesElement = el('div', {}, [`Ходы: ${state.moves}`]);
  pairsElement = el('div', {}, [`Найдено: ${state.pairsFound} / ${state.totalPairs}`]);
  const stats = el('div', { id: 'stats' }, [movesElement, pairsElement]);
  return stats;
}

function initGame() {
  // Clear any existing timer for unflips
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }

  state.moves = 0;
  state.pairsFound = 0;
  state.cards = generateCards();
  state.firstCard = null;
  state.secondCard = null;
  state.lockBoard = false;

  updateStatsUI();
  const newBoard = renderBoard();

  // Initial build if not done yet
  if (!appContainer.querySelector('header')) {
    appContainer.appendChild(renderHeader());
    appContainer.appendChild(renderStats());
  }

  const existingBoard = document.getElementById('game-board');
  if (existingBoard) {
    appContainer.replaceChild(newBoard, existingBoard);
  } else {
    appContainer.appendChild(newBoard);
  }
}

// Start game on load
initGame();
