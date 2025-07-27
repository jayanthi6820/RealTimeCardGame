// Game state
let gameState = {
    players: [
        { id: 1, name: 'You', hand: [], isHuman: true },
        { id: 2, name: 'Player 2', hand: [], isHuman: false },
        { id: 3, name: 'Player 3', hand: [], isHuman: false },
        { id: 4, name: 'Player 4', hand: [], isHuman: false }
    ],
    currentPlayer: 0,
    direction: 1, // 1 for clockwise, -1 for counterclockwise
    topCard: null,
    drawPile: [],
    discardPile: [],
    gameActive: true,
    winner: null,
    lastAction: 'Game Started!',
    unoCallRequired: {},
    wildColorChosen: null,
    pendingWildCard: null
};

// Card types and colors
const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTION_CARDS = ['skip', 'reverse', 'draw-two'];
const WILD_CARDS = ['wild', 'wild-draw-four'];

// DOM elements
const drawBtn = document.getElementById('drawBtn');
const unoBtn = document.getElementById('unoBtn');
const newGameBtn = document.getElementById('newGameBtn');
const colorPicker = document.getElementById('colorPicker');
const winnerModal = document.getElementById('winnerModal');
const topCardElement = document.getElementById('topCard');

// Initialize game
function initGame() {
    createDeck();
    dealCards();
    setTopCard();
    updateDisplay();
    
    // Event listeners
    drawBtn.addEventListener('click', drawCard);
    unoBtn.addEventListener('click', callUno);
    newGameBtn.addEventListener('click', newGame);
    
    // Color picker events
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            chooseWildColor(e.target.dataset.color);
        });
    });
    
    // Player hand click events
    document.getElementById('playerHand').addEventListener('click', (e) => {
        if (e.target.classList.contains('card') && gameState.currentPlayer === 0) {
            playCard(e.target);
        }
    });
}

// Create a full UNO deck
function createDeck() {
    gameState.drawPile = [];
    
    // Number cards (0-9) for each color
    COLORS.forEach(color => {
        NUMBERS.forEach(number => {
            gameState.drawPile.push({ color, type: 'number', value: number });
            // Add second copy of numbers 1-9
            if (number !== '0') {
                gameState.drawPile.push({ color, type: 'number', value: number });
            }
        });
        
        // Action cards (2 of each per color)
        ACTION_CARDS.forEach(action => {
            gameState.drawPile.push({ color, type: 'action', value: action });
            gameState.drawPile.push({ color, type: 'action', value: action });
        });
    });
    
    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
        gameState.drawPile.push({ color: 'wild', type: 'wild', value: 'wild' });
        gameState.drawPile.push({ color: 'wild', type: 'wild', value: 'wild-draw-four' });
    }
    
    // Shuffle deck
    shuffleDeck();
}

// Shuffle the deck
function shuffleDeck() {
    for (let i = gameState.drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.drawPile[i], gameState.drawPile[j]] = [gameState.drawPile[j], gameState.drawPile[i]];
    }
}

// Deal initial cards to players
function dealCards() {
    gameState.players.forEach(player => {
        player.hand = [];
        for (let i = 0; i < 7; i++) {
            if (gameState.drawPile.length > 0) {
                player.hand.push(gameState.drawPile.pop());
            }
        }
    });
}

// Set the initial top card
function setTopCard() {
    let card;
    do {
        if (gameState.drawPile.length === 0) {
            createDeck();
        }
        card = gameState.drawPile.pop();
    } while (card.type === 'wild'); // Don't start with wild cards
    
    gameState.topCard = card;
    gameState.discardPile = [card];
    
    // Handle action cards as starting card
    if (card.type === 'action') {
        handleStartingActionCard(card);
    }
}

// Handle starting action card
function handleStartingActionCard(card) {
    switch (card.value) {
        case 'skip':
            gameState.currentPlayer = getNextPlayer();
            gameState.lastAction = 'Starting card is Skip - Player 2 starts!';
            break;
        case 'reverse':
            gameState.direction = -1;
            gameState.currentPlayer = 3; // Start with Player 4 in reverse
            gameState.lastAction = 'Starting card is Reverse - Player 4 starts!';
            break;
        case 'draw-two':
            gameState.players[1].hand.push(drawCardFromPile());
            gameState.players[1].hand.push(drawCardFromPile());
            gameState.currentPlayer = 2;
            gameState.lastAction = 'Starting card is Draw Two - Player 2 draws 2 cards, Player 3 starts!';
            break;
    }
}

// Draw a card from the draw pile
function drawCardFromPile() {
    if (gameState.drawPile.length === 0) {
        reshuffleDiscardPile();
    }
    if (gameState.drawPile.length === 0) {
        // Emergency: create new deck if still empty
        createDeck();
    }
    return gameState.drawPile.pop();
}

// Reshuffle discard pile into draw pile
function reshuffleDiscardPile() {
    if (gameState.discardPile.length <= 1) return;
    
    const topCard = gameState.discardPile.pop();
    gameState.drawPile = [...gameState.discardPile];
    gameState.discardPile = [topCard];
    
    // Reset wild card colors
    gameState.drawPile.forEach(card => {
        if (card.type === 'wild') {
            delete card.chosenColor;
        }
    });
    
    shuffleDeck();
}

// Check if a card can be played
function canPlayCard(card, topCard) {
    if (card.type === 'wild') return true;
    if (card.color === topCard.color) return true;
    if (topCard.chosenColor && card.color === topCard.chosenColor) return true;
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
    if (card.type === 'action' && topCard.type === 'action' && card.value === topCard.value) return true;
    return false;
}

// Play a card
function playCard(cardElement) {
    if (gameState.currentPlayer !== 0 || !gameState.gameActive) return;
    
    const cardIndex = parseInt(cardElement.dataset.index);
    const card = gameState.players[0].hand[cardIndex];
    
    if (!canPlayCard(card, gameState.topCard)) {
        showMessage("You can't play that card!");
        return;
    }
    
    // Remove card from player's hand
    gameState.players[0].hand.splice(cardIndex, 1);
    
    // Handle wild cards
    if (card.type === 'wild') {
        gameState.pendingWildCard = card;
        showColorPicker();
        return;
    }
    
    // Play the card
    executeCardPlay(card);
}

// Execute card play
function executeCardPlay(card) {
    gameState.topCard = card;
    gameState.discardPile.push(card);
    
    const currentPlayerName = gameState.players[gameState.currentPlayer].name;
    
    // Handle action cards
    if (card.type === 'action') {
        handleActionCard(card);
    } else if (card.type === 'number') {
        gameState.lastAction = `${currentPlayerName} played ${card.color} ${card.value}`;
    }
    
    // Check for winner
    if (gameState.players[gameState.currentPlayer].hand.length === 0) {
        endGame(gameState.currentPlayer);
        return;
    }
    
    // Check for UNO
    if (gameState.players[gameState.currentPlayer].hand.length === 1) {
        gameState.unoCallRequired[gameState.currentPlayer] = true;
        if (gameState.currentPlayer === 0) {
            unoBtn.classList.add('pulse');
            showMessage("Don't forget to call UNO!");
        } else {
            // AI automatically calls UNO
            gameState.unoCallRequired[gameState.currentPlayer] = false;
            gameState.lastAction += ` - ${currentPlayerName} called UNO!`;
        }
    }
    
    // Move to next turn if not skipped by action card
    if (!card.skipNextTurn) {
        nextTurn();
    }
    
    updateDisplay();
    
    // AI turns
    if (!gameState.players[gameState.currentPlayer].isHuman && gameState.gameActive) {
        setTimeout(aiTurn, 1000);
    }
}

// Handle action cards
function handleActionCard(card) {
    const currentPlayerName = gameState.players[gameState.currentPlayer].name;
    const nextPlayerIndex = getNextPlayer();
    const nextPlayerName = gameState.players[nextPlayerIndex].name;
    
    switch (card.value) {
        case 'skip':
            gameState.lastAction = `${currentPlayerName} played Skip! ${nextPlayerName} is skipped.`;
            nextTurn(); // Skip the next player
            card.skipNextTurn = true;
            break;
            
        case 'reverse':
            gameState.direction *= -1;
            gameState.lastAction = `${currentPlayerName} played Reverse! Direction changed.`;
            updateDirectionDisplay();
            break;
            
        case 'draw-two':
            gameState.lastAction = `${currentPlayerName} played Draw Two! ${nextPlayerName} draws 2 cards and is skipped.`;
            // Next player draws 2 cards
            for (let i = 0; i < 2; i++) {
                gameState.players[nextPlayerIndex].hand.push(drawCardFromPile());
            }
            nextTurn(); // Skip the next player's turn
            card.skipNextTurn = true;
            break;
    }
}

// Handle wild card color choice
function chooseWildColor(color) {
    const card = gameState.pendingWildCard;
    if (!card) return;
    
    card.chosenColor = color;
    gameState.topCard = card;
    gameState.discardPile.push(card);
    
    const currentPlayerName = gameState.players[gameState.currentPlayer].name;
    
    if (card.value === 'wild-draw-four') {
        const nextPlayerIndex = getNextPlayer();
        const nextPlayerName = gameState.players[nextPlayerIndex].name;
        
        for (let i = 0; i < 4; i++) {
            gameState.players[nextPlayerIndex].hand.push(drawCardFromPile());
        }
        gameState.lastAction = `${currentPlayerName} played Wild Draw Four! ${nextPlayerName} draws 4 cards. Color is now ${color}.`;
        nextTurn(); // Skip next player
    } else {
        gameState.lastAction = `${currentPlayerName} played Wild! Color is now ${color}.`;
    }
    
    hideColorPicker();
    gameState.pendingWildCard = null;
    
    // Check for winner
    if (gameState.players[gameState.currentPlayer].hand.length === 0) {
        endGame(gameState.currentPlayer);
        return;
    }
    
    // Check for UNO
    if (gameState.players[gameState.currentPlayer].hand.length === 1) {
        gameState.unoCallRequired[gameState.currentPlayer] = true;
        if (gameState.currentPlayer === 0) {
            unoBtn.classList.add('pulse');
            showMessage("Don't forget to call UNO!");
        } else {
            gameState.unoCallRequired[gameState.currentPlayer] = false;
            gameState.lastAction += ` - ${currentPlayerName} called UNO!`;
        }
    }
    
    nextTurn();
    updateDisplay();
    
    if (!gameState.players[gameState.currentPlayer].isHuman && gameState.gameActive) {
        setTimeout(aiTurn, 1000);
    }
}

// Show color picker
function showColorPicker() {
    colorPicker.classList.add('show');
}

// Hide color picker
function hideColorPicker() {
    colorPicker.classList.remove('show');
}

// Get next player index
function getNextPlayer() {
    return (gameState.currentPlayer + gameState.direction + 4) % 4;
}

// Move to next turn
function nextTurn() {
    gameState.currentPlayer = getNextPlayer();
}

// Draw card action
function drawCard() {
    if (gameState.currentPlayer !== 0 || !gameState.gameActive) return;
    
    const card = drawCardFromPile();
    gameState.players[0].hand.push(card);
    
    gameState.lastAction = "You drew a card";
    
    // Check if the drawn card can be played
    if (canPlayCard(card, gameState.topCard)) {
        updateDisplay();
        showMessage("You can play the card you just drew!");
        return;
    }
    
    // End turn
    nextTurn();
    updateDisplay();
    
    if (!gameState.players[gameState.currentPlayer].isHuman && gameState.gameActive) {
        setTimeout(aiTurn, 1000);
    }
}

// Call UNO
function callUno() {
    if (gameState.currentPlayer !== 0) return;
    
    if (gameState.players[0].hand.length === 1) {
        gameState.unoCallRequired[0] = false;
        unoBtn.classList.remove('pulse');
        gameState.lastAction = "You called UNO!";
        updateDisplay();
    } else {
        showMessage("You can only call UNO when you have one card!");
    }
}

// AI turn logic
function aiTurn() {
    if (!gameState.gameActive || gameState.players[gameState.currentPlayer].isHuman) return;
    
    const player = gameState.players[gameState.currentPlayer];
    const playableCards = player.hand.filter(card => canPlayCard(card, gameState.topCard));
    
    if (playableCards.length > 0) {
        // Choose a card to play (improved AI logic)
        let cardToPlay = chooseAICard(playableCards, player);
        
        // Remove card from hand
        const cardIndex = player.hand.indexOf(cardToPlay);
        player.hand.splice(cardIndex, 1);
        
        // Handle wild cards
        if (cardToPlay.type === 'wild') {
            // AI chooses color based on most common color in hand
            const chosenColor = chooseAIColor(player);
            cardToPlay.chosenColor = chosenColor;
            
            if (cardToPlay.value === 'wild-draw-four') {
                const nextPlayerIndex = getNextPlayer();
                const nextPlayerName = gameState.players[nextPlayerIndex].name;
                
                for (let i = 0; i < 4; i++) {
                    gameState.players[nextPlayerIndex].hand.push(drawCardFromPile());
                }
                gameState.lastAction = `${player.name} played Wild Draw Four! ${nextPlayerName} draws 4 cards. Color is now ${chosenColor}.`;
                nextTurn(); // Skip next player
            } else {
                gameState.lastAction = `${player.name} played Wild! Color is now ${chosenColor}.`;
            }
        }
        
        gameState.topCard = cardToPlay;
        gameState.discardPile.push(cardToPlay);
        
        // Handle action cards
        if (cardToPlay.type === 'action') {
            handleActionCard(cardToPlay);
        } else if (cardToPlay.type === 'number') {
            gameState.lastAction = `${player.name} played ${cardToPlay.color} ${cardToPlay.value}`;
        }
        
        // Check for winner
        if (player.hand.length === 0) {
            endGame(gameState.currentPlayer);
            return;
        }
        
        // Auto-call UNO for AI
        if (player.hand.length === 1) {
            gameState.unoCallRequired[gameState.currentPlayer] = false;
            gameState.lastAction += ` - ${player.name} called UNO!`;
        }
        
        if (!cardToPlay.skipNextTurn) {
            nextTurn();
        }
    } else {
        // AI draws a card
        const drawnCard = drawCardFromPile();
        player.hand.push(drawnCard);
        gameState.lastAction = `${player.name} drew a card`;
        
        // Check if AI can play the drawn card (30% chance to play immediately)
        if (canPlayCard(drawnCard, gameState.topCard) && Math.random() < 0.3) {
            setTimeout(aiTurn, 500);
            return;
        }
        
        nextTurn();
    }
    
    updateDisplay();
    
    // Continue AI turns
    if (!gameState.players[gameState.currentPlayer].isHuman && gameState.gameActive) {
        setTimeout(aiTurn, 1500);
    }
}

// Choose AI card with better strategy
function chooseAICard(playableCards, player) {
    // Prefer action cards when opponent has few cards
    const opponentCards = gameState.players.map(p => p.hand.length).filter((count, index) => index !== gameState.currentPlayer);
    const minOpponentCards = Math.min(...opponentCards);
    
    if (minOpponentCards <= 2) {
        const actionCard = playableCards.find(card => card.type === 'action' && (card.value === 'skip' || card.value === 'draw-two'));
        if (actionCard) return actionCard;
    }
    
    // Prefer wild cards if hand is large
    if (player.hand.length > 5) {
        const wildCard = playableCards.find(card => card.type === 'wild');
        if (wildCard) return wildCard;
    }
    
    // Prefer matching color over matching number
    const colorMatches = playableCards.filter(card => 
        card.color === gameState.topCard.color || 
        (gameState.topCard.chosenColor && card.color === gameState.topCard.chosenColor)
    );
    
    if (colorMatches.length > 0) {
        return colorMatches[Math.floor(Math.random() * colorMatches.length)];
    }
    
    // Default: random playable card
    return playableCards[Math.floor(Math.random() * playableCards.length)];
}

// Choose AI color for wild cards
function chooseAIColor(player) {
    const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
    
    player.hand.forEach(card => {
        if (COLORS.includes(card.color)) {
            colorCounts[card.color]++;
        }
    });
    
    // Choose color with most cards, or random if tied
    const maxCount = Math.max(...Object.values(colorCounts));
    const bestColors = Object.keys(colorCounts).filter(color => colorCounts[color] === maxCount);
    
    return bestColors[Math.floor(Math.random() * bestColors.length)];
}

// Update game display
function updateDisplay() {
    updatePlayerHands();
    updateTopCard();
    updateGameStatus();
    updateDrawPile();
    updatePlayerAreas();
}

// Update player hands display
function updatePlayerHands() {
    // Update human player's hand (Player 1)
    const playerHand = document.getElementById('playerHand');
    const player = gameState.players[0];
    
    playerHand.innerHTML = '';
    player.hand.forEach((card, cardIndex) => {
        const cardElement = createCardElement(card, cardIndex);
        if (canPlayCard(card, gameState.topCard) && gameState.currentPlayer === 0) {
            cardElement.classList.add('playable');
        }
        playerHand.appendChild(cardElement);
    });
    
    // Update AI players' hands (show card backs)
    for (let i = 1; i < 4; i++) {
        const playerElement = document.getElementById(`player${i + 1}`);
        const handElement = playerElement.querySelector('.player-hand');
        const player = gameState.players[i];
        
        handElement.innerHTML = '';
        for (let j = 0; j < player.hand.length; j++) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card card-back';
            cardElement.textContent = 'UNO';
            handElement.appendChild(cardElement);
        }
    }
}

// Update player areas
function updatePlayerAreas() {
    gameState.players.forEach((player, index) => {
        const playerElement = document.getElementById(`player${index + 1}`);
        if (!playerElement) return;
        
        const countElement = playerElement.querySelector('.card-count');
        if (!countElement) return;
        
        // Update card count
        countElement.textContent = `${player.hand.length} cards`;
        
        // Update active player
        if (index === gameState.currentPlayer) {
            playerElement.classList.add('active');
        } else {
            playerElement.classList.remove('active');
        }
    });
}

// Create card element
function createCardElement(card, index) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.color}`;
    cardElement.dataset.index = index;
    
    if (card.type === 'number') {
        cardElement.textContent = card.value;
        cardElement.classList.add(`number-${card.value}`);
    } else if (card.type === 'action') {
        cardElement.classList.add(card.value);
        switch (card.value) {
            case 'skip': 
                cardElement.textContent = 'Skip'; 
                break;
            case 'reverse': 
                cardElement.textContent = 'Rev'; 
                break;
            case 'draw-two': 
                cardElement.textContent = '+2'; 
                break;
        }
    } else if (card.type === 'wild') {
        cardElement.classList.add(card.value);
        if (card.value === 'wild') {
            cardElement.textContent = 'Wild';
        } else {
            cardElement.textContent = '+4';
        }
    }
    
    return cardElement;
}

// Update top card display
function updateTopCard() {
    const card = gameState.topCard;
    if (!card) return;
    
    topCardElement.className = `card ${card.chosenColor || card.color}`;
    
    if (card.type === 'number') {
        topCardElement.textContent = card.value;
        topCardElement.classList.add(`number-${card.value}`);
    } else if (card.type === 'action') {
        topCardElement.classList.add(card.value);
        switch (card.value) {
            case 'skip': 
                topCardElement.textContent = 'Skip'; 
                break;
            case 'reverse': 
                topCardElement.textContent = 'Rev'; 
                break;
            case 'draw-two': 
                topCardElement.textContent = '+2'; 
                break;
        }
    } else if (card.type === 'wild') {
        topCardElement.classList.add(card.value);
        if (card.value === 'wild') {
            topCardElement.textContent = 'Wild';
        } else {
            topCardElement.textContent = '+4';
        }
    }
}

// Update game status
function updateGameStatus() {
    const currentPlayerElement = document.querySelector('.current-player');
    const lastActionElement = document.querySelector('.last-action');
    
    if (currentPlayerElement) {
        currentPlayerElement.textContent = `${gameState.players[gameState.currentPlayer].name}'s Turn`;
    }
    
    if (lastActionElement) {
        lastActionElement.textContent = gameState.lastAction;
    }
}

// Update direction display
function updateDirectionDisplay() {
    const directionElement = document.querySelector('.game-direction');
    if (directionElement) {
        directionElement.textContent = gameState.direction === 1 ? '↻ Clockwise' : '↺ Counter-clockwise';
    }
}

// Update draw pile display
function updateDrawPile() {
    const cardsRemaining = document.querySelector('.cards-remaining');
    if (cardsRemaining) {
        cardsRemaining.textContent = gameState.drawPile.length;
    }
}

// Show message
function showMessage(message) {
    const lastActionElement = document.querySelector('.last-action');
    if (!lastActionElement) return;
    
    const originalText = lastActionElement.textContent;
    lastActionElement.textContent = message;
    lastActionElement.style.color = '#e74c3c';
    
    setTimeout(() => {
        lastActionElement.textContent = originalText;
        lastActionElement.style.color = '#636e72';
    }, 2000);
}

// End game
function endGame(winnerIndex) {
    gameState.gameActive = false;
    gameState.winner = winnerIndex;
    
    const winnerText = document.getElementById('winnerText');
    const finalScores = document.getElementById('finalScores');
    
    if (winnerText) {
        winnerText.textContent = `${gameState.players[winnerIndex].name} Wins!`;
    }
    
    // Calculate scores
    if (finalScores) {
        let scoresHTML = '<h4>Final Scores:</h4>';
        gameState.players.forEach((player, index) => {
            const score = calculateScore(player.hand);
            const isWinner = index === winnerIndex;
            scoresHTML += `<div style="${isWinner ? 'background: #d4edda; font-weight: bold;' : ''}">${player.name}: ${score} points</div>`;
        });
        finalScores.innerHTML = scoresHTML;
    }
    
    if (winnerModal) {
        winnerModal.classList.add('show');
    }
}

// Calculate score from hand
function calculateScore(hand) {
    return hand.reduce((total, card) => {
        if (card.type === 'number') return total + parseInt(card.value);
        if (card.type === 'action') return total + 20;
        if (card.type === 'wild') return total + 50;
        return total;
    }, 0);
}

// New game
function newGame() {
    gameState = {
        players: [
            { id: 1, name: 'You', hand: [], isHuman: true },
            { id: 2, name: 'Player 2', hand: [], isHuman: false },
            { id: 3, name: 'Player 3', hand: [], isHuman: false },
            { id: 4, name: 'Player 4', hand: [], isHuman: false }
        ],
        currentPlayer: 0,
        direction: 1,
        topCard: null,
        drawPile: [],
        discardPile: [],
        gameActive: true,
        winner: null,
        lastAction: 'New game started!',
        unoCallRequired: {},
        wildColorChosen: null,
        pendingWildCard: null
    };
    
    if (winnerModal) winnerModal.classList.remove('show');
    if (colorPicker) colorPicker.classList.remove('show');
    if (unoBtn) unoBtn.classList.remove('pulse');
    
    createDeck();
    dealCards();
    setTopCard();
    updateDisplay();
    updateDirectionDisplay();
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', initGame);
