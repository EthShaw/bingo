/**
 * Copyright (c) 2020 Ethan Shaw
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// In case the URL format ever needs to change, we include this.
// It is a 16 bit unsigned integer.
var CARD_URL_VERSION = 0;

// In case the storage format ever needs to change, we include this.
// It is a number.
var CARD_SET_DATA_VERSION = 0.0;

if (!String.prototype.padStart) {
    String.prototype.padStart = function(targetLength, padStr) {
        padStr = padStr || ' ';
        var newStr = this.valueOf();
        var idx = 0;

        while (newStr.length < targetLength) {
            newStr = padStr[idx++ % padStr.length] + newStr;
        }

        return newStr;
    };
}


// Stores the card states in localStorage
function CardStateStore() {
    this.CardData = {};
    this.loadCardData();
}

CardStateStore.prototype.loadCardData = function() {
    var json = localStorage.getItem('CardData');

    if (json) {
        try {
            var data = JSON.parse(json);

            // The following code deletes entries that are older than 30 days or invalid
            var keysToDelete = [];

            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    // !(condition) means that if timestamp is undefined or not
                    // a number, condition will be false, making !(condition)
                    // true, causing the entry to be thrown out.
                    if (!(data[key].timestamp > Date.now() - 1000 * 60 * 60 * 24 * 30)) {
                        keysToDelete.push(key);
                    } else {
                        // Validate the key
                        var dataForCard = data[key];

                        if (dataForCard && dataForCard.state) {
                            var state = dataForCard.state;

                            if (!Array.isArray(state) || state.length !== 5) {
                                // Invalid
                                keysToDelete.push(key);
                            }

                            for (var row = 0; row < 5; row++) {
                                // We don't actually have to check anything
                                // except the length of the array because
                                // anything in the array can be treated as
                                // true or false as will not break any of the
                                // other code. Less code == better.
                                if (!Array.isArray(state[row]) || state[row].length !== 5) {
                                    // Invalid
                                    keysToDelete.push(key);
                                }
                            }
                        }
                    }
                }
            }

            this.CardData = data;

            if (keysToDelete.length > 0) {
                for (var i = 0; i < keysToDelete.length; i++) {
                    delete this.CardData[keysToDelete[i]];
                }
                this.saveCardData();
            }
        } catch (err) {
            console.log('There was an error loading the current layout, clearing it!');
            console.error(err);
            this.CardData = {};
            this.saveCardData();
        }
    }
};

CardStateStore.prototype.saveCardData = function() {
    localStorage.setItem('CardData', JSON.stringify(this.CardData));
};

CardStateStore.prototype.getStateForID = function(cardID) {
    return this.CardData[cardID] ? this.CardData[cardID].state : Card.EMPTY_STATE();
};

CardStateStore.prototype.saveStateForCardID = function(cardID, state) {
    this.CardData[cardID] = {
        'timestamp': Date.now(),
        'state': state
    };
    this.saveCardData();
};

// CardStateStore is a singleton that handles loading and saving data
// from localStorage
var CardStateStore = new CardStateStore();


function Card(cardID) {
    this.ID = cardID;
    this.bingoState = Card.EMPTY_STATE();

    // + and / are replaced with - and _ to make them URL-safe
    idUnescaped = cardID.replace(/-/g, '+').replace(/_/g, '/');

    // We remove the = padding (if present) when creating the base64 cardID,
    // so we have to re-add it here for the base64 to be valid. Basically,
    // the string length for base64 has to be a multiple of four, and
    // equals signs are used as padding to ensure this.
    var base64Str = idUnescaped.padEnd(Math.ceil(idUnescaped.length / 4) * 4, '=');
    var bytes = base64ToBytes(base64Str);

    // Decode the cardID. This is the reverse of createCardID

    // Check if it at least has a version (or 2 bytes that should be the
    // version) at the beginning.
    if (bytes.length < 2) {
        throw 'Error: cardID is invalid!';
    } else {
        var version = readUint16(bytes, 0);
        // At some point, this code could be changed if the cardID format
        // is ever changed so other versions would be supported.
        if (version !== CARD_URL_VERSION) {
            throw 'Error: invalid cardID version: ' + version;
        } else if (bytes.length !== 13) {
            throw 'Error: invalid cardID length: ' + bytes.length;
        } else {
            var seed = readUint32Array(bytes, 2, 2);
            this.rng = new Random(seed);
            this.cardNumber = readUint16(bytes, 10);
            this.hasFreeSpace = (bytes[12] & 0x80) === 0x80;
        }
    }

    this.generateNumbers();
}

// This has to be a function because if it was a variable and a card's state
// was assigned to it, then when the card's state was modified, this would be
// modified also.
Card.EMPTY_STATE = function() {
    return [
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false]
    ];
};

// This is the one place where cardIDs are created and encoded. They are then
// decoded in the Card constructor. `seed` is a Uint32Array, cardNum is an
// integer no greater than 2^16 - 1
Card.createCardID = function(seed, cardNum, hasFreeSpace) {
    var data = new Uint8Array(13);

    writeUint16(CARD_URL_VERSION, data, 0);
    writeUint32Array(seed, data, 2);
    writeUint16(cardNum, data, 10);
    data[12] = hasFreeSpace ? 0x80 : 0;

    // Removing the trailing equals signs (if there are any) makes the cardID
    // URL-safe AND shortens the cardID. See comment in the card constructor
    // for more information. Replacing + and / with - and _ makes the cardID
    // URL-safe.
    return bytesToBase64(data).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');;
};

Card.loadFromURL = function() {
    var params = new URLSearchParams(window.location.search);
    var cardID = params.get('s');

    try {
        // This will throw if the cardID is null or invalid
        var card = new Card(cardID);
        return card;
    } catch (err) {
        console.log('There was an error loading the card from URL!');
        console.error(err);
        return null;
    }
};

// Persists the card's state to localStorage
Card.prototype.persistState = function() {
    CardStateStore.saveStateForCardID(this.ID, this.bingoState);
};

// Gets the card's current state (used when the caller calls a number and when
// the card is initialized)
Card.prototype.setState = function(state) {
    this.bingoState = state;

    if (this.numberGrid) {
        for (var col = 0; col < 5; col++) {
            for (var row = 0; row < 5; row++) {
                var marker = this.numberGrid[row][col].marker;
                if (this.bingoState[row][col]) {
                    marker.classList.add('selected');
                } else {
                    marker.classList.remove('selected');
                }
            }
        }
    }
};

Card.prototype.generateNumbers = function() {
    var ranges = [
        { min: 1, max: 15 },
        { min: 16, max: 30 },
        { min: 31, max: 45 },
        { min: 46, max: 60 },
        { min: 61, max: 75 }
    ];

    // tempNumbers is stored in col,row format for ease of checking for
    // duplicates, but it is then changed to row,col format when transferred
    // to numbers.
    var tempNumbers = [[], [], [], [], []];
    var numbers = [[], [], [], [], []];

    for (var col = 0; col < 5; col++) {
        for (var row = 0; row < 5; row++) {
            var r = ranges[col];
            var rand;
            do {
                rand = r.min + Math.floor(this.rng.nextDouble() * (r.max - r.min + 1));
            } while (tempNumbers[col].includes(rand));

            tempNumbers[col][row] = rand;
        }
    }

    for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 5; col++) {
            numbers[row][col] = tempNumbers[col][row];
        }
    }

    if (this.hasFreeSpace) {
        numbers[2][2] = 'FREE SPACE';
    }

    this.numbers = numbers;
};

Card.prototype.bindToDiv = function(div, editable) {
    var theCard = this;
    this.div = div;

    div.classList.add('bingo-card');

    if (editable) {
        div.classList.add('editable');
    }

    var divControls = document.createElement('div');
    var divCard = document.createElement('div');

    div.appendChild(divControls);
    div.appendChild(divCard);

    // Set up the card controls
    // TODO add button to view printable version, which will hide the controls div
    divControls.classList.add('bingo-controls');
    divControls.classList.add('no-print');

    if (editable) {
        var btnPrintable = document.createElement('button');
        btnPrintable.innerText = 'Printable View';
        divControls.appendChild(btnPrintable);

        btnPrintable.addEventListener('click', function() {
            window.open('print.html?s=' + theCard.ID);
        });

        var btnClear = document.createElement('button');
        btnClear.innerText = 'Clear Card';
        divControls.appendChild(btnClear);

        btnClear.addEventListener('click', function() {
            theCard.setState(Card.EMPTY_STATE());
            theCard.persistState();
        });
    }


    // Set up the card itself
    divCard.classList.add('bingo-numbers-block');

    // Header
    var header = document.createElement('table');
    var headerRow = document.createElement('tr');
    divCard.appendChild(header);
    header.appendChild(headerRow);

    header.classList.add('bingo-table-header');

    var headings = 'BINGO'.split('');

    for (var i = 0; i < 5; i++) {
        var th = document.createElement('th');
        th.innerText = headings[i];
        headerRow.appendChild(th);
    }

    // Numbers and markers
    var tableNums = document.createElement('table');
    var tableMarkers = document.createElement('table');
    divCard.appendChild(tableNums);
    divCard.appendChild(tableMarkers);

    tableNums.classList.add('bingo-table');
    tableMarkers.classList.add('bingo-markers-table');

    this.numberGrid = [];

    for (var row = 0; row < 5; row++) {
        var trNumRow = document.createElement('tr');
        var trMarkerRow = document.createElement('tr');
        tableNums.appendChild(trNumRow);
        tableMarkers.appendChild(trMarkerRow);

        var gridRow = [];

        for (var col = 0; col < 5; col++) {
            var number = this.numbers[row][col].toString();

            var tdCell = document.createElement('td');

            trNumRow.appendChild(tdCell);

            tdCell.innerText = number;
            tdCell.dataset.row = row;
            tdCell.dataset.col = col;

            var tdMarker = document.createElement('td');
            var divMarker = document.createElement('div');

            tdMarker.classList.add('marker');
            tdMarker.appendChild(divMarker);
            trMarkerRow.appendChild(tdMarker);

            if (this.bingoState[row][col]) {
                tdMarker.classList.add('selected');
            }

            var cell = { cell: tdCell, marker: tdMarker };
            gridRow.push(cell);

            if (editable) {
                tdCell.bingoCard = this;

                tdCell.addEventListener('click', function() {
                    var r = parseInt(this.dataset.row);
                    var c = parseInt(this.dataset.col);

                    this.bingoCard.bingoState[r][c] = !this.bingoCard.bingoState[r][c];
                    this.bingoCard.persistState();

                    var marker = this.bingoCard.numberGrid[r][c].marker;

                    if (this.bingoCard.bingoState[r][c]) {
                        marker.classList.add('selected');
                    } else {
                        marker.classList.remove('selected');
                    }
                });
            }
        }

        this.numberGrid.push(gridRow);
    }

    // TODO do this at some other place in a less hacky way
    if (this.hasFreeSpace) {
        this.numberGrid[2][2].cell.classList.add('free-space');
    }

    // Footer (Card Number)
    var cardNumText = 'Card Number: ' + this.cardNumber.toString().padStart(3, '0');
    var pCardNum = document.createElement('span');
    pCardNum.classList.add('bingo-card-number');
    pCardNum.innerText = cardNumText;
    divCard.appendChild(pCardNum);

    this.updateSize();
};

Card.prototype.unbindFromDiv = function() {
    this.div = null;
};

// Updates the size of the size of the card to match the div it is located in
Card.prototype.updateSize = function() {
    // If we're not bound to a div, we do nothing.
    if (this.div) {
        var widthUnit = this.div.clientWidth / 6;
        var heightUnit = this.div.clientHeight / 7;

        var size = Math.min(widthUnit, heightUnit);

        // Make sure every time something changes, this is tested both with and
        // without css variable support.
        if (supportsCSSVariables()) {
            this.div.style.setProperty('--unit-size', size + 'px');
        } else {
            // TODO implement
            throw "Error: not yet implemented!";
        }
    }
}


// Includes the code to create, manage, and store (in localStorage) bingo card sets
function CardManager() {
    this.loadStorage();
}

CardManager.prototype.loadStorage = function() {
    var json = localStorage.getItem('BingoGames');

    if (json) {
        this.BingoGames = JSON.parse(json);
    } else {
        this.BingoGames = { VERSION: CARD_SET_DATA_VERSION, sets: [] };
    }

    if (this.BingoGames.VERSION !== CARD_SET_DATA_VERSION) {
        console.error('Data invalid!');
        console.error(json);
        this.BingoGames = { VERSION: CARD_SET_DATA_VERSION, sets: [] };
    }
};

CardManager.prototype.saveStorage = function() {
    localStorage.setItem('BingoGames', JSON.stringify(this.BingoGames));
};

CardManager.prototype.addSet = function(set) {
    this.BingoGames.sets.push(set);
    this.saveStorage();
};

CardManager.prototype.getAllSets = function() {
    return this.BingoGames.sets;
};

CardManager.prototype.generateCardId = function(num, hasFreeSpace) {
    var seed = [Date.now() + (Math.floor(Math.random() * 65536) << 24), Date.now() + (Math.floor(Math.random() * 65536) << 24)];
    var number;
    if (typeof (num) == 'number') {
        number = num;
    } else {
        number = Math.floor(Math.random() * 1000);
    }
    return Card.createCardID(seed, number, hasFreeSpace);
};

CardManager.prototype.newSet = function(name, count, enableFreeSpace) {
    var set = { name: name, cards: [], freeSpace: enableFreeSpace };

    for (var i = 1; i <= count; i++) {
        var id;

        do {
            id = this.generateCardId(i, enableFreeSpace);
        } while (set.cards.includes(id));

        set.cards.push(id);
    }

    this.addSet(set);
    return set;
};

CardManager.prototype.deleteSetAtIdx = function(idx) {
    this.BingoGames.sets.splice(idx, 1);
    this.saveStorage();
};



function Caller(cardSet) {
    this.cards = cardSet.cards;
    this.liveCards = [];
    this.startGame();
}

Caller.prototype.startGame = function() {
    this.toCall = [];
    this.called = ['FREE SPACE'];

    for (var i = 1; i <= 75; i++) {
        this.toCall.push(i);
    }
};

Caller.prototype.nextCall = function() {
    if (this.toCall.length === 0) {
        return null;
    } else {
        var BINGO = 'BINGO'.split('');
        var num = this.toCall.splice(Math.floor(this.toCall.length * Math.random()), 1)[0];
        this.called.push(num);

        this.updateLiveCards();

        return BINGO[Math.floor((num - 1) / 15)] + num;
    }
};

Caller.prototype.showCard = function(div, cardNum) {
    var id = this.cards[cardNum - 1];
    this.liveCards[cardNum] = new Card(id);

    this.liveCards[cardNum].bindToDiv(div)

    this.updateLiveCards();
};

Caller.prototype.unShowCard = function(div, cardNum) {
    this.liveCards[cardNum].unbindFromDiv();
    this.liveCards[cardNum] = undefined;

    while (div.firstChild) {
        div.removeChild(div.lastChild);
    }
};

Caller.prototype.updateLiveCards = function() {
    for (var i = 0; i < this.liveCards.length; i++) {
        if (this.liveCards[i]) {
            var card = this.liveCards[i];

            var state = Card.EMPTY_STATE();

            for (var row = 0; row < 5; row++) {
                for (var col = 0; col < 5; col++) {
                    if (this.called.includes(card.numbers[row][col])) {
                        state[row][col] = true;
                    }
                }
            }

            card.setState(state);
        }
    }
};
