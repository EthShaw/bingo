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

// IE support
if (!Array.prototype.includes) {
    Array.prototype.includes = function(x) { return this.indexOf(x) !== -1; };
}
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
}

CardStateStore.prototype.saveCardData = function() {
    localStorage.setItem('CardData', JSON.stringify(this.CardData));
}

CardStateStore.prototype.getStateForID = function(cardID) {
    return this.CardData[cardID] ? this.CardData[cardID].state : Card.EMPTY_STATE();
}

CardStateStore.prototype.saveStateForCardID = function(cardID, state) {
    this.CardData[cardID] = {
        'timestamp': Date.now(),
        'state': state
    };
    this.saveCardData();
}

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
}

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
}

Card.loadFromURL = function() {
    var params = new URLSearchParams(window.location.search);
    var cardID = params.get('s');

    try {
        // This will throw if the cardID is null or invalid
        var card = new Card(cardID);
        card.setState(CardStateStore.getStateForID(cardID));
        return card;
    } catch (err) {
        console.log('There was an error loading the card from URL!');
        console.error(err);
        return null;
    }
}

// Persists the card's state to localStorage
Card.prototype.persistState = function() {
    CardStateStore.saveStateForCardID(this.ID, this.bingoState);
}

// Gets the card's current state (used when the caller calls a number and when
// the card is initialized)
Card.prototype.setState = function(state) {
    this.bingoState = state;

    if (this.table) {
        for (var col = 0; col < 5; col++) {
            for (var row = 0; row < 5; row++) {
                var cell = this.table.children[row + 1].children[col];
                if (this.bingoState[row][col]) {
                    cell.classList.add('selected');
                } else {
                    cell.classList.remove('selected');
                }
            }
        }
    }
}

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
}

Card.prototype.bindToTable = function(table, editable) {
    this.table = table;
    //table.id = 'table_' + this.ID;

    table.appendChild(document.createTextNode('Card Number: ' + this.cardNumber.toString().padStart(3, '0')));

    var header = document.createElement('tr');
    var headers = 'BINGO'.split('');

    for (var i = 0; i < 5; i++) {
        var h = document.createElement('th');
        h.innerText = headers[i];
        header.appendChild(h);
    }

    table.append(header);

    for (var row = 0; row < 5; row++) {
        var rowElem = document.createElement('tr');

        for (var col = 0; col < 5; col++) {
            var cell = document.createElement('td');
            var number = this.numbers[row][col].toString();
            cell.innerText = number;
            cell.id = this.cardID + number;

            rowElem.appendChild(cell);

            cell.dataset.row = row;
            cell.dataset.col = col;

            if (this.bingoState[row][col]) {
                cell.classList.add('selected');
            }

            if (editable) {
                // TODO this seems hacky
                cell.card = this;
                cell.onclick = function() {
                    var r = this.dataset.row;
                    var c = this.dataset.col;

                    this.card.bingoState[r][c] = !this.card.bingoState[r][c];
                    this.card.persistState();

                    if (this.card.bingoState[r][c]) {
                        this.classList.add('selected');
                    } else {
                        this.classList.remove('selected');
                    }
                }
            }
        }
        table.append(rowElem);
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
        console.error("Data invalid!");
        console.error(json);
        this.BingoGames = { VERSION: CARD_SET_DATA_VERSION, sets: [] };
    }
}

CardManager.prototype.saveStorage = function() {
    localStorage.setItem('BingoGames', JSON.stringify(this.BingoGames));
}

CardManager.prototype.addSet = function(set) {
    this.BingoGames.sets.push(set);
    this.saveStorage();
}

CardManager.prototype.getAllSets = function() {
    return this.BingoGames.sets;
}

CardManager.prototype.generateCardId = function(num, hasFreeSpace) {
    var seed = [Date.now() + (Math.floor(Math.random() * 65536) << 24), Date.now() + (Math.floor(Math.random() * 65536) << 24)];
    var number;
    if (typeof (num) == 'number') {
        number = num;
    } else {
        number = Math.floor(Math.random() * 1000);
    }
    return Card.createCardID(seed, number, hasFreeSpace);
}

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
}

CardManager.prototype.deleteSetAtIdx = function(idx) {
    this.BingoGames.sets.splice(idx, 1);
    this.saveStorage();
}



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
}

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
}

Caller.prototype.showCard = function(table, cardNum) {
    var id = this.cards[cardNum - 1];
    this.liveCards[cardNum] = new Card(id);

    this.liveCards[cardNum].bindToTable(table)
    
    this.updateLiveCards();
}

Caller.prototype.unShowCard = function(table, cardNum) {
    this.liveCards[cardNum] = undefined;

    while (table.firstChild) {
        table.removeChild(table.lastChild);
    }
}

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
}
